"use client";
import React, { useRef } from "react";
import {
    Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, Box
} from "@chakra-ui/react";

export const TeasyModal = ({ isOpen, onClose, children, ...props }: any) => {
    const silentRef = useRef<HTMLDivElement>(null);
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            closeOnOverlayClick={false}
            isCentered
            scrollBehavior="inside"
            initialFocusRef={props.initialFocusRef || silentRef}
            {...props}
        >
            <Box tabIndex={-1} w={0} h={0} opacity={0} position="fixed" ref={silentRef} />
            {isOpen && children}
        </Modal>
    );
};

export const TeasyModalOverlay = (props: any) => <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(5px)" {...props} />;
export const TeasyModalContent = (props: any) => <ModalContent borderRadius="2xl" boxShadow="2xl" {...props} />;
export const TeasyModalHeader = (props: any) => <ModalHeader bg="brand.500" color="white" fontSize="18px" textAlign="center" py="16px" borderTopRadius="2xl" {...props} />;

export const TeasyModalBody = (props: any) => (
    <ModalBody
        py={8}
        px={6}
        flex="1"
        overflowY="auto"
        overflowX="hidden"
        css={{
            '&::-webkit-scrollbar': { width: '4px' },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
                background: 'rgba(0,0,0,0.08)',
                borderRadius: '10px'
            },
            '&::-webkit-scrollbar-thumb:hover': { background: 'rgba(0,0,0,0.15)' },
            '&::-webkit-scrollbar:horizontal': { display: 'none' }
        }}
        {...props}
    />
);

export const TeasyModalFooter = (props: any) => <ModalFooter gap={4} pb={8} px={6} justifyContent="flex-end" {...props} />;
