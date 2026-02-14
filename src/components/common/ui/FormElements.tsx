"use client";
import React from "react";
import {
    Input, Textarea, FormLabel, Text, HStack, Box, useToast, type InputProps, type TextareaProps, type FormLabelProps, type TextProps, type BoxProps
} from "@chakra-ui/react";
import { formatPhone, formatLicenseKey } from "@/utils/formatter";

export const TeasyInput = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => (
    <Input
        ref={ref}
        h="45px"
        borderRadius="10px"
        focusBorderColor="brand.500"
        fontSize="sm"
        color="gray.700"
        bg={(props.isDisabled || props.isReadOnly) ? "gray.50" : "white"}
        _placeholder={{ color: "gray.300", fontSize: "xs", fontWeight: "normal" }}
        _disabled={{ color: "gray.700", opacity: 1, cursor: "default" }}
        _readOnly={{ color: "gray.700", opacity: 1, cursor: "default" }}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        data-lpignore="true"
        {...props}
    />
));
TeasyInput.displayName = "TeasyInput";

interface TeasyPhoneInputProps extends Omit<InputProps, 'onChange'> {
    value?: string;
    onChange: (val: string) => void;
}

export const TeasyPhoneInput = ({ value, onChange, ...props }: TeasyPhoneInputProps) => (
    <TeasyInput type="tel" placeholder="000-0000-0000" value={formatPhone(value)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(formatPhone(e.target.value))} {...props} />
);

interface TeasyLicenseInputProps extends Omit<InputProps, 'onChange'> {
    value?: string;
    onChange: (val: string) => void;
}

export const TeasyLicenseInput = ({ value, onChange, ...props }: TeasyLicenseInputProps) => (
    <TeasyInput value={value} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(formatLicenseKey(e.target.value))} {...props} />
);

interface TeasyDateTimeInputProps extends Omit<InputProps, 'onChange'> {
    value?: string;
    onChange: (val: string) => void;
    limitType?: "future" | "past";
}

export const TeasyDateTimeInput = ({ value, onChange, limitType, ...props }: TeasyDateTimeInputProps) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const lastCursorPos = React.useRef<number>(0);
    const [selection, setSelection] = React.useState(0);
    const modalOpenTime = React.useRef<Date>(new Date());
    const toast = useToast();

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        const oldValue = value || "";
        let selectionStart = e.target.selectionStart || 0;
        const oldPos = lastCursorPos.current;

        if (!newValue) {
            onChange("");
            return;
        }

        let result = "";
        let targetCursor = selectionStart;

        // 1. Initial Masking (First digit)
        if (oldValue === "") {
            const digit = newValue.replace(/[^0-9]/g, "").substring(0, 1);
            if (!digit) return;
            result = (digit + "   -  -    :  ").substring(0, 17);
            targetCursor = 1;
        } else {
            // 2. Slot-based Editing
            const diff = newValue.length - oldValue.length;
            let base = oldValue.split("");

            if (diff < 0) {
                // Deletion Logic
                if (selectionStart === oldPos) { // Forward Delete
                    let searchIdx = selectionStart;
                    while (searchIdx < 17) {
                        if (![4, 7, 10, 11, 14].includes(searchIdx) && base[searchIdx] !== " ") {
                            base[searchIdx] = " ";
                            break;
                        }
                        searchIdx++;
                    }
                    targetCursor = selectionStart;
                } else { // Backspace
                    let targetIdx = selectionStart;
                    if ([4, 7, 10, 11, 14].includes(targetIdx)) targetIdx--;
                    if (targetIdx >= 0) base[targetIdx] = " ";
                    targetCursor = selectionStart;
                }
                result = base.join("");
            } else {
                // Insertion Logic with Intelligent Auto-Zero
                const addedChar = newValue[selectionStart - 1];
                if (/[0-9]/.test(addedChar)) {
                    let targetIdx = selectionStart - 1;
                    while ([4, 7, 10, 11, 14].includes(targetIdx) && targetIdx < 17) targetIdx++;

                    if (targetIdx < 17) {
                        let isPadded = false;
                        if (targetIdx === 5 && parseInt(addedChar) > 1) {
                            base[5] = "0"; base[6] = addedChar; isPadded = true; targetCursor = 8;
                        } else if (targetIdx === 8 && parseInt(addedChar) > 3) {
                            base[8] = "0"; base[9] = addedChar; isPadded = true; targetCursor = 12;
                        } else if (targetIdx === 12 && parseInt(addedChar) > 2) {
                            base[12] = "0"; base[13] = addedChar; isPadded = true; targetCursor = 15;
                        } else if (targetIdx === 15 && parseInt(addedChar) > 5) {
                            base[15] = "0"; base[16] = addedChar; isPadded = true; targetCursor = 17;
                        }

                        if (!isPadded) {
                            base[targetIdx] = addedChar;
                            targetCursor = targetIdx + 1;
                            while ([4, 7, 10, 11, 14].includes(targetCursor) && targetCursor < 17) targetCursor++;
                        }
                    }
                }
                result = base.join("");
            }
        }

        // 3. Normalization
        const chars = result.split("");
        chars[4] = "-"; chars[7] = "-"; chars[10] = " "; chars[11] = " "; chars[14] = ":";
        let finalStr = chars.join("").substring(0, 17);

        const yyyy = finalStr.substring(0, 4);
        let mm = finalStr.substring(5, 7);
        let dd = finalStr.substring(8, 10);
        let hh = finalStr.substring(12, 14);
        let min = finalStr.substring(15, 17);

        // Auto-pad single digits
        if (mm[0] === " " && /[0-9]/.test(mm[1])) mm = "0" + mm[1];
        if (dd[0] === " " && /[0-9]/.test(dd[1])) dd = "0" + dd[1];
        if (hh[0] === " " && /[0-9]/.test(hh[1])) hh = "0" + hh[1];
        if (min[0] === " " && /[0-9]/.test(min[1])) min = "0" + min[1];

        if (targetCursor > 7 && mm[1] === " " && /[0-9]/.test(mm[0])) mm = "0" + mm[0];
        if (targetCursor > 10 && dd[1] === " " && /[0-9]/.test(dd[0])) dd = "0" + dd[0];
        if (targetCursor > 14 && hh[1] === " " && /[0-9]/.test(hh[0])) hh = "0" + hh[0];

        finalStr = yyyy + "-" + mm + "-" + dd + "  " + hh + ":" + min;

        // Hard Range Validation
        if (mm.trim().length === 2 && parseInt(mm) > 12) finalStr = finalStr.substring(0, 5) + "  " + finalStr.substring(7);
        if (dd.trim().length === 2 && parseInt(dd) > 31) finalStr = finalStr.substring(0, 8) + "  " + finalStr.substring(10);
        if (hh.trim().length === 2 && parseInt(hh) > 23) finalStr = finalStr.substring(0, 12) + "  " + finalStr.substring(14);
        if (min.trim().length === 2 && parseInt(min) > 59) finalStr = finalStr.substring(0, 15) + "  ";

        // 4. Past/Future Time Validation (Only when fully filled)
        if (limitType && finalStr.replace(/\s/g, "").length === 15) { // Check if all digits are filled (YYYY-MM-DDHH:mm)
            const inputDate = new Date(finalStr.replace("  ", " "));
            const refTime = modalOpenTime.current;

            if (limitType === "future" && inputDate > refTime) {
                toast({ title: "미래 시간 입력 불가", status: "warning", duration: 2000, position: "top" });
                const now = new Date();
                finalStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            } else if (limitType === "past" && inputDate < refTime) {
                toast({ title: "과거 시간 입력 불가", status: "warning", duration: 2000, position: "top" });
                const now = new Date();
                finalStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            }
        }

        onChange(finalStr);
        setSelection(targetCursor);

        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.setSelectionRange(targetCursor, targetCursor);
                lastCursorPos.current = targetCursor;
            }
        }, 0);
    };

    const getActiveIdx = (pos: number) => {
        if (pos <= 4) return 0;
        if (pos <= 7) return 1;
        if (pos <= 10) return 2;
        if (pos <= 14) return 3;
        return 4;
    };

    const activeSeg = getActiveIdx(selection);
    const v = value || "                ";
    const segs = [
        { text: v.substring(0, 4), placeholder: "YYYY", idx: 0 },
        { divider: "-", idx: -1 },
        { text: v.substring(5, 7), placeholder: "MM", idx: 1 },
        { divider: "-", idx: -1 },
        { text: v.substring(8, 10), placeholder: "DD", idx: 2 },
        { divider: "  ", idx: -1 },
        { text: v.substring(12, 14), placeholder: "HH", idx: 3 },
        { divider: ":", idx: -1 },
        { text: v.substring(15, 17), placeholder: "mm", idx: 4 }
    ];

    return (
        <Box
            position="relative"
            w="full"
            bg={props.isDisabled ? "gray.50" : "white"}
            border="1px solid"
            borderColor="gray.200"
            borderRadius="10px"
            transition="all 0.2s"
            _focusWithin={{ borderColor: "brand.500", boxShadow: "0 0 0 1px var(--chakra-colors-brand-500)" }}
        >
            <TeasyInput
                ref={inputRef}
                value={value}
                onChange={handleInputChange}
                onSelect={(e: React.SyntheticEvent<HTMLInputElement>) => {
                    const target = e.target as HTMLInputElement;
                    setSelection(target.selectionStart || 0);
                }}
                position="relative"
                zIndex={2}
                bg="transparent"
                border="none"
                px="16px"
                fontSize="sm"
                fontWeight="normal"
                color="gray.700"
                sx={{
                    caretColor: "var(--chakra-colors-brand-500)"
                }}
                letterSpacing="0.5px"
                _focus={{ boxShadow: "none" }}
                {...props}
            />
            <HStack
                position="absolute"
                top="0"
                left="0"
                w="full"
                h="45px"
                px="16px"
                zIndex={1}
                spacing={0}
                pointerEvents="none"
                fontSize="sm"
                fontWeight="normal"
                letterSpacing="0.5px"
            >
                {segs.map((seg, i) => (
                    <React.Fragment key={i}>
                        {seg.divider ? (
                            <Text color="gray.300" whiteSpace="pre">{seg.divider}</Text>
                        ) : (
                            <Box
                                px="1px"
                                bg={seg.idx === activeSeg ? "brand.50" : "transparent"}
                                color="transparent"
                                borderRadius="4px"
                                transition="all 0.1s"
                            >
                                <Box as="span" color={(seg.text || "").trim() === "" ? "gray.300" : "transparent"}>
                                    {(seg.text || "").trim() === "" ? seg.placeholder : seg.text}
                                </Box>
                            </Box>
                        )}
                    </React.Fragment>
                ))}
            </HStack>
        </Box>
    );
};

export const TeasyTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>((props, ref) => (
    <Textarea
        ref={ref}
        borderRadius="lg"
        focusBorderColor="brand.500"
        fontSize="sm"
        color="gray.700"
        bg={(props.isDisabled || props.isReadOnly) ? "gray.50" : "white"}
        minH="100px"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        data-lpignore="true"
        _placeholder={{ color: "gray.300", fontSize: "xs", fontWeight: "normal" }}
        _disabled={{ color: "gray.700", opacity: 1, cursor: "default" }}
        _readOnly={{ color: "gray.700", opacity: 1, cursor: "default" }}
        {...props}
    />
));
TeasyTextarea.displayName = "TeasyTextarea";

export const TeasyFormLabel = ({ sub, children, ...props }: FormLabelProps & { sub?: boolean }) => (
    <FormLabel
        fontSize={sub ? "13px" : "sm"}
        fontWeight={sub ? "500" : "semibold"}
        color="gray.400"
        mb={sub ? 2 : 1.5}
        px={sub ? 1 : 0}
        requiredIndicator={sub ? <></> : undefined}
        display="flex"
        alignItems="center"
        {...props}
    >
        {sub && <Text as="span" mr={1}>·</Text>}
        {children}
    </FormLabel>
);
export const TeasyFormHelperText = (props: TextProps) => <Text fontSize="xs" fontWeight="500" color="gray.400" mt={1} pl={0.5} {...props} />;

interface TeasyFormGroupProps extends BoxProps {
    isWhite?: boolean;
}

export const TeasyFormGroup = React.forwardRef<HTMLDivElement, TeasyFormGroupProps>(({ children, isWhite = false, ...props }, ref) => (
    <Box
        ref={ref}
        p={3}
        bg={isWhite ? "white" : "gray.50"}
        borderRadius="10px"
        border="1px solid"
        borderColor="gray.100"
        w="full"
        {...props}
    >
        {children}
    </Box>
));
TeasyFormGroup.displayName = "TeasyFormGroup";
