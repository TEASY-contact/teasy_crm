const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const path = require('path');
const os = require('os');
const fs = require('fs');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const sharp = require('sharp');

admin.initializeApp();
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Cloud Function: mediaCompressionPipeline (v1)
 * 500MB 대용량 처리를 위해 리소스를 최대화하고, 이름 충돌을 피하기 위해 명칭을 완전히 변경합니다.
 */
exports.mediaCompressionPipeline = functions
    .region('asia-northeast3') // 서울 리전
    .runWith({
        timeoutSeconds: 540, // v1 최대값 (9분)
        memory: '4GB', // 대용량 500MB 처리를 위한 CPU 파워 확보
        maxInstances: 10, // 동시에 실행되는 서버 개수를 10개로 제한 (비용 급증 방지)
    })
    .storage.object()
    .onFinalize(async (object) => {
        const filePath = object.name;
        const bucketName = object.bucket;
        const contentType = object.contentType;

        // 1. 업무 요청 관련 파일만 처리 (이미 압축된 파일 제외)
        if (!filePath.startsWith('work-requests/')) return null;
        if (object.metadata && object.metadata.isCompressed === 'true') {
            console.log('Already compressed. Skipping.');
            return null;
        }

        const fileName = path.basename(filePath);
        const tempFilePath = path.join(os.tmpdir(), fileName);
        const compressedFileName = `compressed_${fileName}`;
        const tempCompressedPath = path.join(os.tmpdir(), compressedFileName);
        const bucket = admin.storage().bucket(bucketName);

        try {
            // 2. 파일 다운로드
            await bucket.file(filePath).download({ destination: tempFilePath });
            console.log('File downloaded for processing:', tempFilePath);

            let success = false;

            // 3. 미디어 유형별 압축 진행
            if (contentType.startsWith('image/')) {
                // 이미지 압축 (Sharp)
                await sharp(tempFilePath)
                    .resize({ width: 1280, withoutEnlargement: true })
                    .jpeg({ quality: 80, progressive: true })
                    .toFile(tempCompressedPath);
                success = true;
            }
            else if (contentType.startsWith('video/')) {
                // 비디오 압축 (FFmpeg)
                await new Promise((resolve, reject) => {
                    ffmpeg(tempFilePath)
                        .outputOptions([
                            '-c:v libx264',
                            '-crf 28',
                            '-preset faster',
                            '-vf scale=-2:720',
                            '-movflags +faststart'
                        ])
                        .on('end', resolve)
                        .on('error', reject)
                        .save(tempCompressedPath);
                });
                success = true;
            }

            if (success) {
                // 4. 압축된 파일 업로드
                const destinationPath = path.join(path.dirname(filePath), compressedFileName);
                await bucket.upload(tempCompressedPath, {
                    destination: destinationPath,
                    metadata: {
                        contentType: contentType,
                        metadata: {
                            isCompressed: 'true',
                            originalName: fileName
                        }
                    }
                });
                console.log('Successfully uploaded compressed file:', destinationPath);
            }
        } catch (error) {
            console.error('Processing error:', error);
        } finally {
            // 5. 임시 공간 정리
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            if (fs.existsSync(tempCompressedPath)) fs.unlinkSync(tempCompressedPath);
        }

        return null;
    });
