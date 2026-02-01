"use client";
import React from "react";
import {
    Input, Textarea, FormLabel, Text, type InputProps, type TextareaProps, type FormLabelProps, type TextProps
} from "@chakra-ui/react";
import { formatPhone, formatLicenseKey } from "@/utils/formatter";

export const TeasyInput = (props: InputProps) => (
    <Input
        h="45px"
        borderRadius="10px"
        focusBorderColor="brand.500"
        fontSize="sm"
        color="gray.700"
        _placeholder={{ color: "gray.400", fontSize: "13px", fontWeight: "normal" }}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        data-lpignore="true"
        {...props}
    />
);

export const TeasyPhoneInput = ({ value, onChange, ...props }: any) => (
    <TeasyInput type="tel" placeholder="000-0000-0000" value={formatPhone(value)} onChange={(e: any) => onChange(formatPhone(e.target.value))} {...props} />
);

export const TeasyLicenseInput = ({ value, onChange, ...props }: any) => (
    <TeasyInput value={value} onChange={(e: any) => onChange(formatLicenseKey(e.target.value))} {...props} />
);

export const TeasyDateTimeInput = ({ value, onChange, ...props }: any) => {
    return <TeasyInput value={value} onChange={(e: any) => onChange(e.target.value)} {...props} />;
};

export const TeasyTextarea = (props: TextareaProps) => (
    <Textarea
        borderRadius="lg"
        focusBorderColor="brand.500"
        fontSize="sm"
        color="gray.700"
        minH="100px"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        data-lpignore="true"
        _placeholder={{ color: "gray.400", fontSize: "13px", fontWeight: "normal" }}
        {...props}
    />
);

export const TeasyFormLabel = ({ sub, ...props }: FormLabelProps & { sub?: boolean }) => <FormLabel fontSize={sub ? "xs" : "13px"} fontWeight={sub ? "500" : "600"} color="gray.400" mb={1.5} requiredIndicator={sub ? <></> : undefined} {...props} />;
export const TeasyFormHelperText = (props: TextProps) => <Text fontSize="11px" fontWeight="500" color="gray.400" mt={1} pl={0.5} {...props} />;
