// functions/triggers/onActivityUpdate.js
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * activities 문서 업데이트 시 두 가지 자동 처리:
 * 1. 전자세금계산서 등록 → 미완료 요청서 자동 완료
 * 2. purchase_confirm + 입금 + 전자세금계산서 미등록 조건 충족 시 → 1차 요청 발송
 */
const onActivityUpdate = functions
    .region('asia-northeast3')
    .runWith({ timeoutSeconds: 60, memory: '256MB' })
    .firestore.document('activities/{activityId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        const activityId = context.params.activityId;

        // === Case 1: 전자세금계산서 등록 → 미완료 요청 자동 완료 ===
        if (after.type === 'purchase_confirm') {
            const hadTaxInvoice = !!before.taxInvoice;
            const hasTaxInvoice = !!after.taxInvoice;

            if (!hadTaxInvoice && hasTaxInvoice) {
                console.log(`[onActivityUpdate] 전자세금계산서 등록 감지: ${activityId}`);

                const requestsSnap = await db.collection('work_requests')
                    .where('relatedActivityId', '==', activityId)
                    .where('triggerType', 'in', ['tax_biz_securing', 'tax_biz_delay'])
                    .get();

                if (!requestsSnap.empty) {
                    const batch = db.batch();
                    let updatedCount = 0;

                    requestsSnap.docs.forEach(docSnap => {
                        const data = docSnap.data();
                        if (data.status === 'pending' || data.status === 'review_requested') {
                            batch.update(docSnap.ref, {
                                status: 'approved',
                                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                                autoCompletedByTaxInvoice: true
                            });
                            updatedCount++;
                        }
                    });

                    if (updatedCount > 0) {
                        await batch.commit();
                        console.log(`[onActivityUpdate] ${updatedCount}건 자동 완료 처리`);
                    }
                }

                return null;
            }
        }

        // === Case 2: purchase_confirm + 입금 + 전자세금계산서 미등록 → 1차 요청 발송 ===
        // 업데이트 후 이 조건이 새로 충족된 경우에만 처리
        const wasTarget = before.type === 'purchase_confirm' && before.payMethod === '입금' && !before.taxInvoice;
        const isTarget = after.type === 'purchase_confirm' && after.payMethod === '입금' && !after.taxInvoice;

        if (isTarget && !wasTarget) {
            console.log(`[onActivityUpdate] 1차 요청 대상 조건 충족 감지: ${activityId}`);

            // 중복 확인
            const existingRequests = await db.collection('work_requests')
                .where('relatedActivityId', '==', activityId)
                .where('triggerType', 'in', ['tax_biz_securing', 'tax_biz_delay'])
                .get();

            if (!existingRequests.empty) {
                console.log('[onActivityUpdate] 이미 요청서 존재 - 건너뜀');
                return null;
            }

            // 담당자 설정 조회
            const settingsSnap = await db.doc('settings/work_managers').get();
            if (!settingsSnap.exists) return null;
            const settings = settingsSnap.data();
            const bizManagerId = settings.bizRegistrationManagerId;
            const taxManagerId = settings.taxInvoiceManagerId;

            if (!bizManagerId || !taxManagerId) return null;

            // 1차 요청서 발송
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

            console.log(`[onActivityUpdate] 1차 요청서 발송 완료: ${activityId}`);
            return null;
        }

        return null;
    });

module.exports = { onActivityUpdate };

