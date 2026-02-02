"use client";
import { useState } from "react";
import {
    Box,
    VStack,
    HStack,
    Heading,
    Text,
    Button,
    Icon,
    Alert,
    AlertIcon,
    AlertTitle,
    AlertDescription,
    useToast,
    Progress,
    Divider,
    Checkbox,
    Stack
} from "@chakra-ui/react";
import { MdDeleteForever, MdWarning, MdArrowBack } from "react-icons/md";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
    collection,
    getDocs,
    writeBatch,
    doc,
    deleteDoc,
    query,
    where,
    limit,
    updateDoc
} from "firebase/firestore";

export default function DatabaseManagementPage() {
    const router = useRouter();
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState("");
    const [resetOptions, setResetOptions] = useState({
        customers: true,
        activities: true,
        customerMeta: true,
        assets: true,
        assetMeta: true
    });

    const deleteCollection = async (collectionName: string) => {
        let deletedCount = 0;
        while (true) {
            const q = query(collection(db, collectionName), limit(500));
            const snapshot = await getDocs(q);
            if (snapshot.empty) break;

            const batch = writeBatch(db);
            snapshot.docs.forEach((d) => {
                batch.delete(d.ref);
                deletedCount++;
            });
            await batch.commit();
            setStatusText(`${collectionName} 삭제 중... (${deletedCount}개 완료)`);
        }
    };

    const resetAssetMeta = async () => {
        let updatedCount = 0;
        const q = collection(db, "asset_meta");
        const snapshot = await getDocs(q);

        const chunks = [];
        for (let i = 0; i < snapshot.docs.length; i += 500) {
            chunks.push(snapshot.docs.slice(i, i + 500));
        }

        for (const chunk of chunks) {
            const batch = writeBatch(db);
            chunk.forEach((d) => {
                batch.update(d.ref, {
                    currentStock: 0,
                    totalInflow: 0,
                    totalOutflow: 0,
                    lastAction: "system_reset",
                    lastHealedAt: null
                });
                updatedCount++;
            });
            await batch.commit();
            setStatusText(`품목 메타데이터 초기화 중... (${updatedCount}개 완료)`);
        }
    };

    const handleReset = async () => {
        const confirmResult = window.confirm(
            "⚠️ [경고] 선택한 모든 데이터가 영구적으로 삭제됩니다.\n이 작업은 되돌릴 수 없습니다. 정말 진행하시겠습니까?"
        );
        if (!confirmResult) return;

        const doubleConfirm = window.prompt("데이터 삭제를 위해 [초기화] 라고 입력해주세요.");
        if (doubleConfirm !== "초기화") {
            toast({ title: "입력값이 일치하지 않아 취소되었습니다.", status: "warning", position: "top" });
            return;
        }

        setIsLoading(true);
        try {
            let stepPercent = 100 / Object.values(resetOptions).filter(Boolean).length;
            let currentPercent = 0;

            if (resetOptions.customers) {
                await deleteCollection("customers");
                currentPercent += stepPercent;
                setProgress(currentPercent);
            }

            if (resetOptions.activities) {
                await deleteCollection("activities");
                currentPercent += stepPercent;
                setProgress(currentPercent);
            }

            if (resetOptions.customerMeta) {
                await deleteCollection("customer_meta");
                currentPercent += stepPercent;
                setProgress(currentPercent);
            }

            if (resetOptions.assets) {
                await deleteCollection("assets");
                currentPercent += stepPercent;
                setProgress(currentPercent);
            }

            if (resetOptions.assetMeta) {
                await resetAssetMeta();
                currentPercent += stepPercent;
                setProgress(currentPercent);
            }

            setProgress(100);
            setStatusText("데이터베이스 리셋이 완료되었습니다.");
            toast({
                title: "리셋 완료",
                description: "선택한 모든 데이터가 초기화되었습니다.",
                status: "success",
                duration: 5000,
                isClosable: true,
                position: "top"
            });
        } catch (error) {
            console.error("Reset failed:", error);
            toast({
                title: "리셋 실패",
                description: "오류가 발생했습니다. 로그를 확인해주세요.",
                status: "error",
                position: "top"
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box p={8} bg="gray.50" minH="100vh">
            <HStack mb={8} spacing={4}>
                <Button
                    variant="ghost"
                    leftIcon={<MdArrowBack />}
                    onClick={() => router.push("/admin")}
                >
                    돌아가기
                </Button>
                <Heading size="lg" color="gray.700">데이터베이스 관리</Heading>
            </HStack>

            <VStack spacing={8} align="stretch" maxW="800px" mx="auto">
                <Alert
                    status="warning"
                    variant="subtle"
                    flexDirection="column"
                    alignItems="center"
                    justifyContent="center"
                    textAlign="center"
                    height="auto"
                    py={6}
                    borderRadius="xl"
                    bg="orange.50"
                    border="1px solid"
                    borderColor="orange.200"
                >
                    <AlertIcon boxSize="40px" mr={0} />
                    <AlertTitle mt={4} mb={1} fontSize="lg">
                        데이터베이스 전체 초기화 주의사항
                    </AlertTitle>
                    <AlertDescription maxWidth="sm" color="gray.600">
                        이 기능은 시스템 운영 중 초기화가 필요할 때만 사용해야 합니다.
                        삭제된 데이터는 복구가 불가능하므로 신중하게 결정해 주세요.
                    </AlertDescription>
                </Alert>

                <Box bg="white" p={8} borderRadius="xl" shadow="sm" border="1px" borderColor="gray.100">
                    <VStack align="stretch" spacing={6}>
                        <VStack align="start" spacing={1}>
                            <Text fontWeight="bold" fontSize="lg" color="gray.700">리셋 항목 선택</Text>
                            <Text fontSize="sm" color="gray.500">초기화할 데이터 범위를 선택하세요.</Text>
                        </VStack>

                        <Stack spacing={4} direction="column">
                            <Checkbox
                                colorScheme="red"
                                isChecked={resetOptions.customers}
                                onChange={(e) => setResetOptions({ ...resetOptions, customers: e.target.checked })}
                            >
                                <VStack align="start" spacing={0}>
                                    <Text fontWeight="medium">고객 정보 전체 삭제</Text>
                                    <Text fontSize="xs" color="gray.400">등록된 모든 고객 명단이 삭제됩니다.</Text>
                                </VStack>
                            </Checkbox>
                            <Checkbox
                                colorScheme="red"
                                isChecked={resetOptions.activities}
                                onChange={(e) => setResetOptions({ ...resetOptions, activities: e.target.checked })}
                            >
                                <VStack align="start" spacing={0}>
                                    <Text fontWeight="medium">활동 및 보고서 이력 삭제</Text>
                                    <Text fontSize="xs" color="gray.400">모든 상담, 시연, 구매, AS 보고서가 삭제됩니다.</Text>
                                </VStack>
                            </Checkbox>
                            <Checkbox
                                colorScheme="red"
                                isChecked={resetOptions.customerMeta}
                                onChange={(e) => setResetOptions({ ...resetOptions, customerMeta: e.target.checked })}
                            >
                                <VStack align="start" spacing={0}>
                                    <Text fontWeight="medium">고객 메타데이터 초기화</Text>
                                    <Text fontSize="xs" color="gray.400">보고서 일련번호 등이 초기화됩니다.</Text>
                                </VStack>
                            </Checkbox>
                            <Checkbox
                                colorScheme="red"
                                isChecked={resetOptions.assets}
                                onChange={(e) => setResetOptions({ ...resetOptions, assets: e.target.checked })}
                            >
                                <VStack align="start" spacing={0}>
                                    <Text fontWeight="medium">재고 변동 이력(Assets) 삭제</Text>
                                    <Text fontSize="xs" color="gray.400">입고 및 출고 이력이 모두 삭제됩니다.</Text>
                                </VStack>
                            </Checkbox>
                            <Checkbox
                                colorScheme="red"
                                isChecked={resetOptions.assetMeta}
                                onChange={(e) => setResetOptions({ ...resetOptions, assetMeta: e.target.checked })}
                            >
                                <VStack align="start" spacing={0}>
                                    <Text fontWeight="medium">품목 재고 수치 0으로 리셋</Text>
                                    <Text fontSize="xs" color="gray.400">모든 품목의 현재 재고 수량이 0이 됩니다. (품목명은 유지)</Text>
                                </VStack>
                            </Checkbox>
                        </Stack>

                        <Divider />

                        {isLoading ? (
                            <VStack align="stretch" spacing={4}>
                                <Text textAlign="center" fontWeight="bold" color="red.500">{statusText}</Text>
                                <Progress value={progress} size="lg" colorScheme="red" borderRadius="full" hasStripe isAnimated />
                            </VStack>
                        ) : (
                            <Button
                                size="lg"
                                colorScheme="red"
                                leftIcon={<Icon as={MdDeleteForever} fontSize="2xl" />}
                                onClick={handleReset}
                                h="60px"
                                borderRadius="xl"
                            >
                                선택한 데이터 리셋 실행
                            </Button>
                        )}
                    </VStack>
                </Box>
            </VStack>
        </Box>
    );
}
