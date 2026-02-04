"use client";
import React, { forwardRef } from "react";
import { Button, type ButtonProps } from "@chakra-ui/react";

interface TeasyButtonProps extends ButtonProps {
    version?: 'primary' | 'secondary' | 'danger' | 'ghost';
}

export const TeasyButton = forwardRef<HTMLButtonElement, TeasyButtonProps>(
    ({ version = 'primary', children, ...props }, ref) => {
        const baseStyles: any = {
            primary: { bg: "brand.500", color: "white", hoverBg: "brand.600" },
            secondary: { variant: "outline", borderColor: "rgba(128, 90, 213, 0.3)", color: "brand.500", hoverBg: "rgba(128, 90, 213, 0.1)" },
            danger: { variant: "outline", borderColor: "rgba(229, 62, 62, 0.3)", color: "red.500", hoverBg: "rgba(229, 62, 62, 0.1)" },
            ghost: { variant: "outline", borderColor: "gray.200", color: "gray.500", hoverBg: "gray.50", hoverColor: "brand.500" }
        };

        const currentStyle = baseStyles[version];

        return (
            <Button
                ref={ref}
                size="sm"
                h="32px"
                borderRadius="10px"
                fontWeight="bold"
                transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                bg={currentStyle.bg}
                color={currentStyle.color}
                variant={currentStyle.variant}
                borderColor={currentStyle.borderColor}
                _hover={{
                    transform: "translateY(-1px)",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                    bg: currentStyle.hoverBg,
                    color: currentStyle.hoverColor || currentStyle.color
                }}
                _active={{
                    transform: "scale(0.97)",
                    boxShadow: "none"
                }}
                type={props.type || "button"}
                {...props}
            >
                {children}
            </Button>
        );
    }
);
TeasyButton.displayName = "TeasyButton";
