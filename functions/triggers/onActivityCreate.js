// functions/triggers/onActivityCreate.js
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * 구매확정 보고서 생성 시, 전자세금계산서가 없으면
 * 즉시 1차 요청서를 자동 발송한다.
 * (발신: 전자세금계산서 담당자, 수신: 사업자등록증 담당자)
 */
const onActivityCreate = functions
    .region('asia-northeast3')
    .runWith({ timeoutSeconds: 60, memory: '256MB' })
    .firestore.document('activities/{activityId}')
    .onCreate(async (snap, context) => {
        const data = snap.data();
        const activityId = context.params.activityId;

        // 1. purchase_confirm + 입금 + 전자세금계산서 미등록인 경우만 처리
        if (data.type !== 'purchase_confirm') return null;
        if (data.payMethod !== '입금') return null;
        if (data.taxInvoice) return null;

        console.log(`[onActivityCreate] 1차 요청 대상 감지: ${activityId}`);

        // 2. 담당자 설정 조회
        const settingsSnap = await db.doc('settings/work_managers').get();
        if (!settingsSnap.exists) {
            console.error('[onActivityCreate] 업무 담당자 설정 없음');
            return null;
        }
        const settings = settingsSnap.data();
        const bizManagerId = settings.bizRegistrationManagerId;
        const taxManagerId = settings.taxInvoiceManagerId;

        if (!bizManagerId || !taxManagerId) {
            console.error('[onActivityCreate] 담당자 미지정');
            return null;
        }

        // 3. 중복 확인 (이미 요청서가 존재하면 건너뜀)
        const existingRequests = await db.collection('work_requests')
            .where('relatedActivityId', '==', activityId)
            .where('triggerType', 'in', ['tax_biz_securing', 'tax_biz_delay'])
            .get();

        if (!existingRequests.empty) {
            console.log('[onActivityCreate] 이미 요청서 존재 - 건너뜀');
            return null;
        }

        // 4. 1차 요청서 발송 (발신: 세금계산서 담당자, 수신: 사업자등록증 담당자)
        await db.collection('work_requests').add({
            title: '사업자등록증 확보 요청',
            content: '전자세금계산서 발행을 위한 사업자등록증 전달 바랍니다.',
            senderId: taxManagerId,
            receiverId: bizManagerId,
            participants: [taxManagerId, bizManagerId],
            status: 'pending',
            attachments: [],
            relatedActivityId: activityId,
            triggerType: 'tax_biz_securing',
            messages: [],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastReadTimestamp: admin.firestore.FieldValue.serverTimestamp(),
            readStatus: {
                [taxManagerId]: true,
                [bizManagerId]: false
            }
        });

        console.log(`[onActivityCreate] 1차 요청서 발송 완료: ${activityId}`);
        return null;
    });

module.exports = { onActivityCreate };
