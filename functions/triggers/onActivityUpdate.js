// functions/triggers/onActivityUpdate.js
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * 전자세금계산서가 등록되면, 해당 보고서와 연결된
 * 미완료 업무 요청서(tax_biz_securing, tax_biz_delay)를 자동 완료 처리
 */
const onActivityUpdate = functions
    .region('asia-northeast3')
    .runWith({ timeoutSeconds: 60, memory: '256MB' })
    .firestore.document('activities/{activityId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        const activityId = context.params.activityId;

        // 1. purchase_confirm 타입만 처리
        if (after.type !== 'purchase_confirm') return null;

        // 2. taxInvoice 필드가 '없음 → 있음'으로 변경된 경우만 처리
        const hadTaxInvoice = !!before.taxInvoice;
        const hasTaxInvoice = !!after.taxInvoice;

        if (hadTaxInvoice || !hasTaxInvoice) {
            // 이미 있었거나, 여전히 없으면 무시
            return null;
        }

        console.log(`[onActivityUpdate] 전자세금계산서 등록 감지: ${activityId}`);

        // 3. 해당 보고서와 연결된 미완료 업무 요청서 조회
        const requestsSnap = await db.collection('work_requests')
            .where('relatedActivityId', '==', activityId)
            .where('triggerType', 'in', ['tax_biz_securing', 'tax_biz_delay'])
            .get();

        if (requestsSnap.empty) {
            console.log('[onActivityUpdate] 연결된 업무 요청서 없음');
            return null;
        }

        // 4. 미완료(pending, review_requested) 요청서 → approved로 변경
        const batch = db.batch();
        let updatedCount = 0;

        requestsSnap.docs.forEach(docSnap => {
            const data = docSnap.data();
            if (data.status === 'pending' || data.status === 'review_requested') {
                batch.update(docSnap.ref, {
                    status: 'approved',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    autoCompletedByTaxInvoice: true // 자동 완료 플래그
                });
                updatedCount++;
            }
        });

        if (updatedCount > 0) {
            await batch.commit();
            console.log(`[onActivityUpdate] ${updatedCount}건 자동 완료 처리`);
        }

        return null;
    });

module.exports = { onActivityUpdate };
