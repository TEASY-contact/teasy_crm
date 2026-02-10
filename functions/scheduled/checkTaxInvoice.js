// functions/scheduled/checkTaxInvoice.js
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const https = require('https');

const db = admin.firestore();
const SYSTEM_SENDER_ID = 'TEASY_SYSTEM';

/**
 * Nager.Date API로 올해 한국 공휴일 목록을 가져온다.
 * 무료 API, 키 불필요.
 */
function fetchKoreanHolidays(year) {
    return new Promise((resolve, reject) => {
        const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/KR`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const holidays = JSON.parse(data);
                    // Set of 'YYYY-MM-DD' strings
                    const holidaySet = new Set(holidays.map(h => h.date));
                    resolve(holidaySet);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

/**
 * 날짜가 영업일(평일 + 비공휴일)인지 확인
 */
function isBusinessDay(date, holidaySet) {
    const day = date.getDay(); // 0=일, 6=토
    if (day === 0 || day === 6) return false;
    const dateStr = date.toISOString().split('T')[0];
    return !holidaySet.has(dateStr);
}

/**
 * 기준일로부터 N 영업일이 경과했는지 확인
 * (기준일 포함하여 계산, 즉 기준일이 1영업일째)
 */
function hasElapsedBusinessDays(baseDate, requiredDays, today, holidaySet) {
    let count = 0;
    const cursor = new Date(baseDate);
    cursor.setHours(0, 0, 0, 0);
    const todayCopy = new Date(today);
    todayCopy.setHours(0, 0, 0, 0);

    while (cursor <= todayCopy) {
        if (isBusinessDay(cursor, holidaySet)) {
            count++;
        }
        cursor.setDate(cursor.getDate() + 1);
    }

    // 기준일 포함 3영업일 경과 = count >= 4 (기준일 + 3일 더)
    return count > requiredDays;
}

/**
 * 요일 한국어 변환
 */
function getDayOfWeekKorean(date) {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return days[date.getDay()];
}

/**
 * 날짜를 YYYY.MM.DD(요일) 형식으로 변환
 */
function formatDateKorean(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}.${m}.${d}(${getDayOfWeekKorean(date)})`;
}

/**
 * 메인 스케줄러 함수
 * 매일 09:00 KST 실행 → 영업일에만 동작
 */
const checkTaxInvoice = functions
    .region('asia-northeast3')
    .runWith({ timeoutSeconds: 300, memory: '256MB' })
    .pubsub.schedule('0 9 * * *')
    .timeZone('Asia/Seoul')
    .onRun(async (context) => {
        const now = new Date();
        // KST 기준 오늘 날짜
        const kstOffset = 9 * 60 * 60 * 1000;
        const kstNow = new Date(now.getTime() + kstOffset);
        const today = new Date(kstNow.toISOString().split('T')[0] + 'T00:00:00Z');

        try {
            // 1. 공휴일 목록 가져오기
            const holidaySet = await fetchKoreanHolidays(today.getFullYear());

            // 2. 영업일 확인 - 토/일/공휴일이면 즉시 종료
            if (!isBusinessDay(today, holidaySet)) {
                console.log(`[checkTaxInvoice] 비영업일 - 종료 (${today.toISOString().split('T')[0]})`);
                return null;
            }

            // 3. 랜덤 대기 (3분 ~ 10분)
            const delayMs = (180 + Math.floor(Math.random() * 420)) * 1000;
            console.log(`[checkTaxInvoice] ${Math.round(delayMs / 1000)}초 대기 후 실행`);
            await new Promise(resolve => setTimeout(resolve, delayMs));

            // 4. 담당자 설정 조회 (기존 settings/work_managers 사용)
            const settingsSnap = await db.doc('settings/work_managers').get();
            if (!settingsSnap.exists) {
                console.error('[checkTaxInvoice] 업무 담당자 설정이 없습니다.');
                return null;
            }
            const settings = settingsSnap.data();
            const bizManagerId = settings.bizRegistrationManagerId;
            const taxManagerId = settings.taxInvoiceManagerId;

            if (!bizManagerId || !taxManagerId) {
                console.error('[checkTaxInvoice] 사업자등록증 또는 전자세금계산서 담당자가 미지정입니다.');
                return null;
            }

            // 5. 담당자 이름 조회
            const [bizManagerSnap, taxManagerSnap] = await Promise.all([
                db.collection('users').doc(bizManagerId).get(),
                db.collection('users').doc(taxManagerId).get()
            ]);
            const bizManagerName = bizManagerSnap.exists ? bizManagerSnap.data().name : '담당자';
            const taxManagerName = taxManagerSnap.exists ? taxManagerSnap.data().name : '담당자';

            // 6. 전자세금계산서 미등록 보고서 조회
            //    - type: 'purchase_confirm'
            //    - payMethod: '입금' (세금계산서 발행 대상)
            //    - taxInvoice 필드가 없거나 null인 문서
            const activitiesSnap = await db.collection('activities')
                .where('type', '==', 'purchase_confirm')
                .where('payMethod', '==', '입금')
                .get();

            const targetActivities = activitiesSnap.docs.filter(doc => {
                const data = doc.data();
                // taxInvoice 필드가 없거나 null이면 미등록
                return !data.taxInvoice;
            });

            console.log(`[checkTaxInvoice] 미등록 보고서 ${targetActivities.length}건 발견`);

            // 7. 각 보고서별 처리
            let firstRequestCount = 0;
            let followUpCount = 0;
            let skippedCount = 0;

            for (const actDoc of targetActivities) {
                const actData = actDoc.data();
                const activityId = actDoc.id;

                // 보고서 등록일 (createdAt)
                const createdAt = actData.createdAt?.toDate ? actData.createdAt.toDate() : new Date(actData.createdAt);

                // 해당 보고서와 연결된 기존 요청서 조회
                const existingRequests = await db.collection('work_requests')
                    .where('relatedActivityId', '==', activityId)
                    .where('triggerType', 'in', ['tax_biz_securing', 'tax_biz_delay'])
                    .get();

                if (existingRequests.empty) {
                    // Case A: 최초 요청 대상 - 3영업일 경과 확인
                    if (hasElapsedBusinessDays(createdAt, 3, today, holidaySet)) {
                        await createFirstRequest(activityId, taxManagerId, bizManagerId);
                        firstRequestCount++;
                    }
                } else {
                    // 진행 중인 요청이 있는지 확인
                    const hasPending = existingRequests.docs.some(d => {
                        const status = d.data().status;
                        return status === 'pending' || status === 'review_requested';
                    });

                    if (hasPending) {
                        // Case B: 진행 중인 요청 존재 → 발송 안 함
                        skippedCount++;
                    } else {
                        // Case C: 모든 이전 요청 완료 → 후속 요청 발송
                        // 1차 요청의 reviewRequestedAt 찾기
                        const firstRequest = existingRequests.docs
                            .filter(d => d.data().triggerType === 'tax_biz_securing')
                            .sort((a, b) => {
                                const tA = a.data().createdAt?.toMillis?.() || 0;
                                const tB = b.data().createdAt?.toMillis?.() || 0;
                                return tA - tB;
                            })[0];

                        let reviewDateStr = '(날짜 정보 없음)';
                        if (firstRequest) {
                            const reviewedAt = firstRequest.data().reviewRequestedAt;
                            if (reviewedAt) {
                                const reviewDate = reviewedAt.toDate ? reviewedAt.toDate() : new Date(reviewedAt);
                                reviewDateStr = formatDateKorean(reviewDate);
                            }
                        }

                        await createFollowUpRequest(
                            activityId, bizManagerId,
                            bizManagerName, taxManagerName, reviewDateStr
                        );
                        followUpCount++;
                    }
                }
            }

            console.log(`[checkTaxInvoice] 완료 - 1차: ${firstRequestCount}건, 후속: ${followUpCount}건, 건너뜀: ${skippedCount}건`);
            return null;

        } catch (error) {
            console.error('[checkTaxInvoice] 실행 중 오류:', error);
            return null;
        }
    });

/**
 * Case A: 1차 요청 발송
 */
async function createFirstRequest(activityId, senderId, receiverId) {
    await db.collection('work_requests').add({
        title: '사업자등록증 확보 요청',
        content: '전자세금계산서 발행을 위한 사업자등록증 전달 바랍니다.',
        senderId,
        receiverId,
        participants: [senderId, receiverId],
        status: 'pending',
        attachments: [],
        relatedActivityId: activityId,
        triggerType: 'tax_biz_securing',
        messages: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastReadTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        readStatus: {
            [senderId]: true,
            [receiverId]: false
        }
    });
}

/**
 * Case C: 후속 요청 발송 (SYSTEM 발신)
 */
async function createFollowUpRequest(activityId, receiverId, bizManagerName, taxManagerName, reviewDateStr) {
    const content = `${bizManagerName}님이 ${reviewDateStr}에 ${taxManagerName}님에게 전달한 사업자등록증 정보가 반영된 전자세금계산서가 아직 등록되지 않은 상태입니다. ${taxManagerName}님에게 등록을 다시 한번 요청해주세요.`;

    await db.collection('work_requests').add({
        title: '전자세금계산서 장기 미등록 발생',
        content,
        senderId: SYSTEM_SENDER_ID,
        receiverId,
        participants: [SYSTEM_SENDER_ID, receiverId],
        status: 'pending',
        attachments: [],
        relatedActivityId: activityId,
        triggerType: 'tax_biz_delay',
        messages: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastReadTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        readStatus: {
            [SYSTEM_SENDER_ID]: true,
            [receiverId]: false
        }
    });
}

module.exports = { checkTaxInvoice };
