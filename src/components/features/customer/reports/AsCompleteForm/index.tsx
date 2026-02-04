"use client";
import React, { forwardRef, useImperativeHandle, useRef, useEffect } from "react";
import { formatPhone } from "@/utils/formatter";
import { VStack, FormControl, Box, Spinner, HStack, Flex, Text, IconButton, Badge, Checkbox, useToast } from "@chakra-ui/react";
import { MdRemove, MdAdd, MdDragHandle, MdOutlineFilePresent, MdCheckCircleOutline, MdFileDownload } from "react-icons/md";
import { Reorder, useDragControls } from "framer-motion";
import { CustomSelect } from "@/components/common/CustomSelect";
import {
    TeasyDateTimeInput,
    TeasyFormLabel,
    TeasyInput,
    TeasyTextarea,
    TeasyPhoneInput,
    TeasyFormGroup,
    TeasyFormHelperText,
    ThinParen
} from "@/components/common/UIComponents";
import { TeasyUniversalViewer, triggerTeasyDownload } from "@/components/common/ui/MediaViewer";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { normalizeText } from "@/utils/textFormatter";
import { useAsCompleteForm } from "./useAsCompleteForm";
import { AsCompleteFormData, AsCompleteFormHandle, AS_COMPLETE_CONSTANTS } from "./types";
import { getCircledNumber } from "@/components/features/asset/AssetModalUtils";
import { PhotoGrid } from "../common/PhotoGrid";
import { SelectedItem } from "../InstallScheduleForm/types";

interface AsCompleteFormProps {
    customer: { id: string, name: string, address?: string, phone?: string };
    activities?: any[];
    activityId?: string;
    initialData?: Partial<AsCompleteFormData>;
    isReadOnly?: boolean;
    defaultManager?: string;
}

const ProductListItem = ({ item, idx, isReadOnly, onUpdateQty, constraintsRef, onDragEnd }: {
    item: SelectedItem,
    idx: number,
    isReadOnly: boolean,
    onUpdateQty: (id: string, delta: number) => void,
    constraintsRef: React.RefObject<HTMLDivElement>,
    onDragEnd?: () => void
}) => {
    const controls = useDragControls();
    return (
        <Reorder.Item as="div" value={item} dragListener={false} dragControls={controls} onDragEnd={onDragEnd} style={{ marginBottom: "0px", userSelect: "none" }}>
            <HStack justify="space-between" bg="white" px={3} py={1.5} minH="36px" borderRadius="md" shadow="xs" border="1px solid" borderColor="gray.100" transition="all 0.2s">
                <HStack spacing={3} flex={1}>
                    {!isReadOnly && (
                        <Box color="gray.300" cursor="grab" _active={{ cursor: "grabbing" }} onPointerDown={(e) => controls.start(e)} p={1} borderRadius="sm" _hover={{ bg: "gray.100", color: "gray.400" }} display="flex" alignItems="center">
                            <MdDragHandle size="18" />
                        </Box>
                    )}
                    <Text fontSize="sm" color="gray.700" fontWeight="medium">
                        <Text as="span" color="brand.500" mr={2} fontWeight="bold">{getCircledNumber(idx + 1)}</Text>
                        {item.name}
                    </Text>
                </HStack>
                <HStack spacing={2}>
                    {!isReadOnly && (
                        <IconButton aria-label="decrease-qty" icon={<MdRemove />} size="xs" variant="ghost" colorScheme="gray" onClick={() => onUpdateQty(item.id, -1)} />
                    )}
                    <Badge bg="purple.50" color="purple.700" fontSize="11px" px={1} h="20px" minW="24px" borderRadius="sm" display="flex" alignItems="center" justifyContent="center" fontWeight="700">
                        {item.quantity}
                    </Badge>
                    {!isReadOnly && (
                        <IconButton aria-label="increase-qty" icon={<MdAdd />} size="xs" variant="ghost" colorScheme="gray" onClick={() => onUpdateQty(item.id, 1)} />
                    )}
                </HStack>
            </HStack>
        </Reorder.Item>
    );
};

// --- File Row Sub-component ---
const FileRow = ({ file, onRemove, onConfirm, isReadOnly, showConfirm = true, onDownload }: {
    file: any,
    onRemove: () => void,
    onConfirm?: () => void,
    isReadOnly?: boolean,
    showConfirm?: boolean,
    onDownload?: () => void
}) => {
    const handleDownload = async () => {
        if (onDownload) {
            onDownload();
            return;
        }
        try {
            await triggerTeasyDownload(file);
        } catch (error) {
            window.open(file.url, '_blank');
        }
    };

    return (
        <HStack w="full" spacing={3} p={1} align="center" justify="space-between">
            <Box flex={1} isTruncated fontSize="xs" color="gray.600" fontWeight="medium" textAlign="left">
                {(() => {
                    const rawName = file.displayName || file.name || "파일";
                    let processed = rawName.replace(/[\s\u00A0\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff]/g, '_');
                    if (processed.includes('.')) {
                        const parts = processed.split('.');
                        parts.pop();
                        processed = parts.join('.');
                    }
                    return <ThinParen text={processed} />;
                })()}
            </Box>
            <HStack spacing={1.5} flexShrink={0}>
                {showConfirm && onConfirm && (
                    <>
                        <Badge
                            as="button" bg="gray.100" color="gray.500" fontSize="10px" px={2} h="18px"
                            display="flex" alignItems="center" justifyContent="center" borderRadius="15%"
                            cursor="pointer" transition="all 0.2s" _hover={{ bg: "gray.500", color: "white" }}
                            onClick={(e) => { e.stopPropagation(); onConfirm(); }}
                            fontWeight="600" textTransform="none"
                        >
                            확인
                        </Badge>
                        <Text color="gray.300" fontSize="10px" fontWeight="bold" lineHeight="18px">/</Text>
                    </>
                )}
                <Badge
                    as="button" bg="gray.100" color="gray.500" fontSize="10px" px={2} h="18px"
                    display="flex" alignItems="center" justifyContent="center" borderRadius="15%"
                    cursor="pointer" transition="all 0.2s" _hover={{ bg: "gray.500", color: "white" }}
                    onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                    fontWeight="600" textTransform="none"
                >
                    다운로드
                </Badge>
                {!isReadOnly && (
                    <>
                        <Text color="gray.300" fontSize="10px" fontWeight="bold" lineHeight="18px">/</Text>
                        <Badge
                            as="button" bg="gray.100" color="gray.500" fontSize="10px" px={2} h="18px"
                            display="flex" alignItems="center" justifyContent="center" borderRadius="15%"
                            cursor="pointer" transition="all 0.2s" _hover={{ bg: "red.400", color: "white" }}
                            onClick={(e) => { e.stopPropagation(); onRemove(); }}
                            fontWeight="600" textTransform="none"
                        >
                            삭제
                        </Badge>
                    </>
                )}
            </HStack>
        </HStack>
    );
};

export const AsCompleteForm = forwardRef<AsCompleteFormHandle, AsCompleteFormProps>(({
    customer,
    activities = [],
    activityId,
    initialData,
    isReadOnly = false,
    defaultManager = ""
}, ref) => {
    const toast = useToast();
    const { managerOptions, asTypeOptions, products, inventoryItems } = useReportMetadata();
    const {
        formData, setFormData,
        isLoading,
        handleFileUpload, removePhoto,
        handleAttachmentUpload, removeAttachment,
        toggleCheck,
        submit,
        handleDelete
    } = useAsCompleteForm({ customer, activities, activityId, initialData, defaultManager });

    const silentRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const commitmentInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const [viewerState, setViewerState] = React.useState({ isOpen: false, files: [] as any[], index: 0 });
    const productScrollRef = useRef<HTMLDivElement>(null);
    const supplyScrollRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
        submit: () => submit(managerOptions),
        delete: handleDelete
    }), [submit, handleDelete, managerOptions]);

    useEffect(() => {
        if (silentRef.current) silentRef.current.focus();
    }, []);

    const hasIncomplete = [...formData.symptoms, ...formData.tasks].some(t => !t.completed);

    const handleUpdateProductQty = (id: string, delta: number) => {
        setFormData(prev => {
            const newList = [...prev.selectedProducts];
            const idx = newList.findIndex(p => p.id === id);
            if (idx === -1) return prev;
            const newQty = newList[idx].quantity + delta;
            if (newQty <= 0) {
                if (window.confirm("항목을 삭제하시겠습니까?")) return { ...prev, selectedProducts: newList.filter(p => p.id !== id) };
                return prev;
            }
            newList[idx].quantity = newQty;
            return { ...prev, selectedProducts: newList };
        });
    };

    const handleUpdateSupplyQty = (id: string, delta: number) => {
        setFormData(prev => {
            const newList = [...prev.selectedSupplies];
            const idx = newList.findIndex(p => p.id === id);
            if (idx === -1) return prev;
            const newQty = newList[idx].quantity + delta;
            if (newQty < 0) return prev;
            newList[idx].quantity = newQty;
            return { ...prev, selectedSupplies: newList };
        });
    };

    return (
        <Box position="relative">
            <Box ref={silentRef} tabIndex={0} position="absolute" top="-100px" left="-100px" opacity={0} pointerEvents="none" />
            {isLoading && (
                <Flex position="absolute" top={0} left={0} right={0} bottom={0} bg="whiteAlpha.800" zIndex={20} align="center" justify="center" borderRadius="md" backdropFilter="blur(2px)">
                    <VStack spacing={4}>
                        <Spinner size="xl" color="brand.500" thickness="4px" />
                        <Text fontWeight="medium" color="brand.600">처리 중...</Text>
                    </VStack>
                </Flex>
            )}

            <VStack spacing={6} align="stretch">
                <HStack spacing={4}>
                    <FormControl isRequired isReadOnly={isReadOnly} flex={1}>
                        <TeasyFormLabel>완료 일시</TeasyFormLabel>
                        {isReadOnly ? (
                            <TeasyInput value={formData.date} isReadOnly />
                        ) : (
                            <TeasyDateTimeInput
                                value={formData.date}
                                onChange={(val: string) => setFormData({ ...formData, date: val })}
                                limitType="future"
                            />
                        )}
                    </FormControl>
                    <FormControl isRequired isReadOnly={isReadOnly} flex={1}>
                        <TeasyFormLabel>담당자</TeasyFormLabel>
                        {isReadOnly ? (
                            <TeasyInput value={managerOptions.find(o => o.value === formData.manager)?.label || formData.manager} isReadOnly />
                        ) : (
                            <CustomSelect options={managerOptions} value={formData.manager} onChange={(val) => setFormData({ ...formData, manager: val })} placeholder="담당자 선택" isDisabled={isReadOnly} />
                        )}
                    </FormControl>
                </HStack>

                <FormControl isRequired isReadOnly={isReadOnly} flex={1}>
                    <TeasyFormLabel>방문 주소</TeasyFormLabel>
                    <TeasyInput
                        value={formData.location}
                        onChange={(e: any) => setFormData({ ...formData, location: normalizeText(e.target.value) })}
                        placeholder="방문 주소 입력"
                        isReadOnly={isReadOnly}
                    />
                </FormControl>

                <FormControl isRequired isReadOnly={isReadOnly}>
                    <TeasyFormLabel>연락처</TeasyFormLabel>
                    {isReadOnly ? (
                        <TeasyInput value={formatPhone(formData.phone)} isReadOnly />
                    ) : (
                        <TeasyPhoneInput value={formData.phone} onChange={(val: string) => setFormData({ ...formData, phone: val })} />
                    )}
                </FormControl>

                <HStack spacing={4} align="flex-start">
                    <FormControl isRequired flex={1}>
                        <TeasyFormLabel>유형 선택</TeasyFormLabel>
                        <TeasyInput value={formData.asType} isReadOnly placeholder="확정 데이터 대기 중" />
                    </FormControl>

                    <FormControl flex={1.2}>
                        <TeasyFormLabel>점검 상품</TeasyFormLabel>
                        {!isReadOnly && (
                            <CustomSelect placeholder="상품 선택" value="" onChange={(val: string) => {
                                const info = products.find(p => p.value === val) as any;
                                if (info) setFormData(prev => ({ ...prev, selectedProducts: [...prev.selectedProducts, { id: Math.random().toString(36).substr(2, 9), name: info.label, quantity: 1, category: info.category || "" }] }));
                            }} options={products} isDisabled={isReadOnly} />
                        )}
                    </FormControl>
                </HStack>

                {/* 점검 상품 리스트: Reorder 기반 */}
                {formData.selectedProducts.length > 0 && (
                    <TeasyFormGroup ref={productScrollRef} mt={-2}>
                        <Reorder.Group axis="y" values={formData.selectedProducts} onReorder={(list) => setFormData(prev => ({ ...prev, selectedProducts: list }))} style={{ listStyleType: "none" }}>
                            <VStack align="stretch" spacing={2}>
                                {formData.selectedProducts.map((item, idx) => (
                                    <ProductListItem
                                        key={item.id}
                                        item={item}
                                        idx={idx}
                                        isReadOnly={isReadOnly}
                                        onUpdateQty={handleUpdateProductQty}
                                        constraintsRef={productScrollRef}
                                        onDragEnd={() => toast({ title: "순서가 변경되었습니다.", status: "success", position: "top", duration: 1500 })}
                                    />
                                ))}
                            </VStack>
                        </Reorder.Group>
                    </TeasyFormGroup>
                )}

                {/* 점검 증상 */}
                {formData.symptoms.length > 0 && (
                    <FormControl isRequired>
                        <TeasyFormLabel>점검 증상</TeasyFormLabel>
                        <TeasyFormGroup>
                            <VStack spacing={2} align="stretch">
                                {formData.symptoms.map((item, idx) => (
                                    <HStack
                                        key={idx}
                                        spacing={3}
                                        bg="white"
                                        px={3}
                                        py={1.5}
                                        minH="36px"
                                        borderRadius="md"
                                        shadow="xs"
                                        border="1px solid"
                                        borderColor="gray.100"
                                        w="full"
                                        justify="space-between"
                                    >
                                        <HStack spacing={1} flex={1}>
                                            <Text fontSize="sm" fontWeight="bold" color="brand.500" minW="20px" textAlign="center">
                                                {getCircledNumber(idx + 1)}
                                            </Text>
                                            <Text fontSize="sm" color="gray.700" fontWeight="medium">
                                                {item.text}
                                            </Text>
                                        </HStack>
                                        <Checkbox
                                            isChecked={item.completed}
                                            onChange={() => !isReadOnly && toggleCheck('symptoms', idx)}
                                            isDisabled={isReadOnly}
                                            colorScheme="brand"
                                        />
                                    </HStack>
                                ))}
                                {/* 미처리 사유 (증상 전용) */}
                                {formData.symptoms.some(t => !t.completed) && (
                                    <Box pt={2}>
                                        <TeasyFormLabel sub>점검 불가 사유</TeasyFormLabel>
                                        <TeasyTextarea
                                            value={formData.symptomIncompleteReason}
                                            onChange={(e: any) => !isReadOnly && setFormData({ ...formData, symptomIncompleteReason: e.target.value })}
                                            placeholder="점검되지 않은 증상이 있습니다. 사유를 입력해주세요."
                                            size="sm"
                                            pl={3}
                                            isReadOnly={isReadOnly}
                                            w="full"
                                        />
                                    </Box>
                                )}
                            </VStack>
                        </TeasyFormGroup>
                    </FormControl>
                )}

                {/* 수행 결과 (작업) */}
                {formData.tasks.length > 0 && (
                    <FormControl isRequired>
                        <TeasyFormLabel>수행 결과</TeasyFormLabel>
                        <TeasyFormGroup>
                            <VStack spacing={2} align="stretch">
                                {formData.tasks.map((item, idx) => (
                                    <HStack
                                        key={idx}
                                        spacing={3}
                                        bg="white"
                                        px={3}
                                        py={1.5}
                                        minH="36px"
                                        borderRadius="md"
                                        shadow="xs"
                                        border="1px solid"
                                        borderColor="gray.100"
                                        w="full"
                                        justify="space-between"
                                    >
                                        <HStack spacing={1} flex={1}>
                                            <Text fontSize="sm" fontWeight="bold" color="brand.500" minW="20px" textAlign="center">
                                                {getCircledNumber(idx + 1)}
                                            </Text>
                                            <Text fontSize="sm" color="gray.700" fontWeight="medium">
                                                {item.text}
                                            </Text>
                                        </HStack>
                                        <Checkbox
                                            isChecked={item.completed}
                                            onChange={() => !isReadOnly && toggleCheck('tasks', idx)}
                                            isDisabled={isReadOnly}
                                            colorScheme="brand"
                                        />
                                    </HStack>
                                ))}
                                {/* 미처리 사유 (수행결과 전용) */}
                                {formData.tasks.some(t => !t.completed) && (
                                    <Box pt={2}>
                                        <TeasyFormLabel sub>수행 불가 사유</TeasyFormLabel>
                                        <TeasyTextarea
                                            value={formData.taskIncompleteReason}
                                            onChange={(e: any) => !isReadOnly && setFormData({ ...formData, taskIncompleteReason: e.target.value })}
                                            placeholder="수행되지 않은 업무가 있습니다. 사유를 입력해주세요."
                                            size="sm"
                                            pl={3}
                                            isReadOnly={isReadOnly}
                                            w="full"
                                        />
                                    </Box>
                                )}
                            </VStack>
                        </TeasyFormGroup>
                    </FormControl>
                )}

                {/* 사용 내역 */}
                <FormControl isRequired isReadOnly={isReadOnly}>
                    <TeasyFormLabel>사용 내역</TeasyFormLabel>
                    <VStack align="stretch" spacing={3}>
                        {!isReadOnly && (
                            <CustomSelect placeholder="물품 추가" value="" onChange={(val: string) => {
                                const info = inventoryItems.find(p => p.value === val) as any;
                                if (info) setFormData(prev => ({ ...prev, selectedSupplies: [...prev.selectedSupplies, { id: Math.random().toString(36).substr(2, 9), name: info.label, quantity: 1, category: info.category || "" }] }));
                            }} options={inventoryItems} isDisabled={isReadOnly} />
                        )}
                        {formData.selectedSupplies.length > 0 && (
                            <TeasyFormGroup ref={supplyScrollRef}>
                                <Reorder.Group axis="y" values={formData.selectedSupplies} onReorder={(list) => setFormData(prev => ({ ...prev, selectedSupplies: list }))} style={{ listStyleType: "none" }}>
                                    <VStack align="stretch" spacing={2}>
                                        {formData.selectedSupplies.map((item, idx) => (
                                            <ProductListItem
                                                key={item.id}
                                                item={item}
                                                idx={idx}
                                                isReadOnly={isReadOnly}
                                                onUpdateQty={handleUpdateSupplyQty}
                                                constraintsRef={supplyScrollRef}
                                                onDragEnd={() => toast({ title: "순서가 변경되었습니다.", status: "success", position: "top", duration: 1500 })}
                                            />
                                        ))}
                                    </VStack>
                                </Reorder.Group>
                            </TeasyFormGroup>
                        )}
                    </VStack>
                </FormControl>
                {formData.asType === "이전 시공" && (
                    <FormControl isRequired>
                        <TeasyFormLabel>
                            시공 확약서 <Text as="span" fontWeight="400" ml={1}>(*2장 필수)</Text>
                        </TeasyFormLabel>
                        <TeasyFormGroup p={2}>
                            <VStack spacing={2}>
                                {!isReadOnly && formData.commitmentFiles.length < 5 && (
                                    <Box w="full">
                                        <input
                                            type="file"
                                            multiple={true}
                                            accept="image/*"
                                            ref={commitmentInputRef}
                                            style={{ display: "none" }}
                                            onChange={(e) => { handleAttachmentUpload(e.target.files, 'commitment'); e.target.value = ''; }}
                                        />
                                        <Badge
                                            as="button"
                                            w="full"
                                            h="32px"
                                            bg="gray.100"
                                            color="gray.600"
                                            border="1px solid"
                                            borderColor="gray.200"
                                            _hover={{ bg: "gray.200" }}
                                            borderRadius="10px"
                                            fontSize="xs"
                                            fontWeight="600"
                                            display="flex"
                                            alignItems="center"
                                            justifyContent="center"
                                            textTransform="none"
                                            onClick={() => commitmentInputRef.current?.click()}
                                        >
                                            파일 업로드 ({formData.commitmentFiles.length}/2)
                                        </Badge>
                                    </Box>
                                )}
                                {formData.commitmentFiles.map((file, idx) => (
                                    <FileRow
                                        key={file.id}
                                        file={file}
                                        isReadOnly={isReadOnly}
                                        onRemove={() => removeAttachment(file.id, 'commitment')}
                                        onConfirm={() => setViewerState({ isOpen: true, files: formData.commitmentFiles, index: idx })}
                                        onDownload={async () => {
                                            for (let i = 0; i < formData.commitmentFiles.length; i++) {
                                                await triggerTeasyDownload(formData.commitmentFiles[i]);
                                                if (i < formData.commitmentFiles.length - 1) await new Promise(r => setTimeout(r, 200));
                                            }
                                        }}
                                    />
                                ))}
                            </VStack>
                        </TeasyFormGroup>
                    </FormControl>
                )}

                {/* --- 수거 전 동영상 Section --- */}
                {formData.asType === "방문 수거" && (
                    <FormControl isRequired>
                        <TeasyFormLabel>수거 전 동영상</TeasyFormLabel>
                        <TeasyFormGroup p={2}>
                            <VStack spacing={2}>
                                {!isReadOnly && !formData.collectionVideo && (
                                    <Box w="full">
                                        <input
                                            type="file"
                                            accept="video/mp4,video/x-m4v,video/*"
                                            ref={videoInputRef}
                                            style={{ display: "none" }}
                                            onChange={(e) => { handleAttachmentUpload(e.target.files, 'collection_video'); e.target.value = ''; }}
                                        />
                                        <Badge
                                            as="button"
                                            w="full"
                                            h="32px"
                                            bg="gray.100"
                                            color="gray.600"
                                            border="1px solid"
                                            borderColor="gray.200"
                                            _hover={{ bg: "gray.200" }}
                                            borderRadius="10px"
                                            fontSize="xs"
                                            fontWeight="600"
                                            display="flex"
                                            alignItems="center"
                                            justifyContent="center"
                                            textTransform="none"
                                            onClick={() => videoInputRef.current?.click()}
                                        >
                                            동영상 업로드 (0/1)
                                        </Badge>
                                    </Box>
                                )}
                                {formData.collectionVideo && (
                                    <FileRow
                                        file={formData.collectionVideo}
                                        isReadOnly={isReadOnly}
                                        showConfirm={false}
                                        onRemove={() => removeAttachment(formData.collectionVideo!.id, 'collection_video')}
                                    />
                                )}
                            </VStack>
                        </TeasyFormGroup>
                    </FormControl>
                )}

                {/* --- 설치 후 동영상 Section --- */}
                {formData.asType === "방문 재설치" && (
                    <FormControl isRequired>
                        <TeasyFormLabel>설치 후 동영상</TeasyFormLabel>
                        <TeasyFormGroup p={2}>
                            <VStack spacing={2}>
                                {!isReadOnly && !formData.reinstallationVideo && (
                                    <Box w="full">
                                        <input
                                            type="file"
                                            accept="video/mp4,video/x-m4v,video/*"
                                            ref={videoInputRef}
                                            style={{ display: "none" }}
                                            onChange={(e) => { handleAttachmentUpload(e.target.files, 'reinstall_video'); e.target.value = ''; }}
                                        />
                                        <Badge
                                            as="button"
                                            w="full"
                                            h="32px"
                                            bg="gray.100"
                                            color="gray.600"
                                            border="1px solid"
                                            borderColor="gray.200"
                                            _hover={{ bg: "gray.200" }}
                                            borderRadius="10px"
                                            fontSize="xs"
                                            fontWeight="600"
                                            display="flex"
                                            alignItems="center"
                                            justifyContent="center"
                                            textTransform="none"
                                            onClick={() => videoInputRef.current?.click()}
                                        >
                                            동영상 업로드 (0/1)
                                        </Badge>
                                    </Box>
                                )}
                                {formData.reinstallationVideo && (
                                    <FileRow
                                        file={formData.reinstallationVideo}
                                        isReadOnly={isReadOnly}
                                        showConfirm={false}
                                        onRemove={() => removeAttachment(formData.reinstallationVideo!.id, 'reinstall_video')}
                                    />
                                )}
                            </VStack>
                        </TeasyFormGroup>
                    </FormControl>
                )}

                <FormControl isReadOnly={isReadOnly}>
                    <TeasyFormLabel>현장 사진 ({formData.photos.length}/{AS_COMPLETE_CONSTANTS.MAX_PHOTOS})</TeasyFormLabel>
                    <Box p={4} border="1px dashed" borderColor="gray.200" borderRadius="xl" bg="white">
                        <PhotoGrid photos={formData.photos} isReadOnly={isReadOnly} onAddClick={() => fileInputRef.current?.click()} onRemoveClick={removePhoto} maxPhotos={AS_COMPLETE_CONSTANTS.MAX_PHOTOS} />
                        <input type="file" multiple accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={(e) => e.target.files && (handleFileUpload(e.target.files), e.target.value = '')} />
                    </Box>
                </FormControl>

                <FormControl isReadOnly={isReadOnly}>
                    <TeasyFormLabel>참고 사항</TeasyFormLabel>
                    <TeasyTextarea value={formData.memo} onChange={(e: any) => !isReadOnly && setFormData({ ...formData, memo: e.target.value })} minH="120px" isReadOnly={isReadOnly} placeholder="작업 상세 내용을 입력하세요" />
                </FormControl>
            </VStack>

            <TeasyUniversalViewer
                isOpen={viewerState.isOpen}
                onClose={() => setViewerState({ isOpen: false, files: [], index: 0 })}
                files={viewerState.files}
                initialIndex={viewerState.index}
            />
        </Box>
    );
});

AsCompleteForm.displayName = "AsCompleteForm";
