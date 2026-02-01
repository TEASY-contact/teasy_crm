// src/hooks/useBulkImport.ts
"use client";
import { useState } from "react";
import { db } from "@/lib/firebase";
import { writeBatch, doc, collection } from "firebase/firestore";

export const useBulkImport = () => {
    const [progress, setProgress] = useState(0);

    const importCustomers = async (file: File) => {
        // Dynamic Import for Atomic Optimization (v122.0)
        // XLSX is heavy (hundreds of KB), so we load it only on demand.
        const XLSX = (await import("xlsx"));

        const reader = new FileReader();
        reader.onload = async (e) => {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet);

            // 100-unit Batch Processing (v122.0)
            const chunkSize = 100;
            for (let i = 0; i < rows.length; i += chunkSize) {
                const batch = writeBatch(db);
                const chunk = rows.slice(i, i + chunkSize);

                chunk.forEach((row: any) => {
                    const newDocRef = doc(collection(db, "customers"));
                    // treat as history: no inventory impact for bulk import (v122.0)
                    batch.set(newDocRef, {
                        ...row,
                        isImported: true,
                        createdAt: new Date().toISOString(),
                    });
                });

                await batch.commit();
                setProgress(Math.round(((i + chunk.length) / rows.length) * 100));
            }
        };
        reader.readAsArrayBuffer(file);
    };

    return { importCustomers, progress };
};
