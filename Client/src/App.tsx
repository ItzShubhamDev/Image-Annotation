import { useState, useRef, useEffect } from "react";
import {
    Dot,
    Eraser,
    ImageDown,
    ImageUp,
    Send,
    Square,
    Upload,
} from "lucide-react";

type Point = {
    x: number;
    y: number;
};

type BoundingBox = {
    startX: number;
    startY: number;
    width: number;
    height: number;
};

function App() {
    const [uploadedImage, setUploadedImage] = useState<string>("");
    const [points, setPoints] = useState<Point[]>([]);
    const [negativePoints, setNegativePoints] = useState<Point[]>([]);
    const [boxes, setBoxes] = useState<BoundingBox[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentBox, setCurrentBox] = useState<BoundingBox | null>(null);
    const [mode, setMode] = useState<"point" | "box" | "preview">("point");
    const [img, setImg] = useState<HTMLImageElement | null>(null);
    const [mask, setMask] = useState<string | null>(null);
    const [name, setName] = useState<string | null>(null);

    const handleImageUpload = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            setUploadedImage(e.target?.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async () => {
        if (isLoading) return;
        if (!uploadedImage) return;
        if (!canvasRef.current) return;
        if (points.length === 0 && boxes.length === 0) return;
        setIsLoading(true);

        canvasRef.current?.toBlob(async (blob) => {
            const formData = new FormData();
            formData.append("image", blob!);
            const p = points.map((point) => [point.x, point.y]);
            formData.append("points", JSON.stringify(p));
            const b = boxes.map((box) => [
                box.startX,
                box.startY,
                box.startX + box.width,
                box.startY + box.height,
            ]);
            if (b.length > 0) {
                formData.append("boxes", JSON.stringify(b[0]));
            }
            if (negativePoints.length > 0) {
                const np = negativePoints.map((point) => [point.x, point.y]);
                formData.append("negatives", JSON.stringify(np));
            }

            try {
                const res = await fetch("/sam", {
                    method: "POST",
                    body: formData,
                });

                const data = await res.json();

                if (!data.content.masks || !data.content.masks.length) {
                    setIsLoading(false);
                    return alert("No mask found");
                }

                const base64 = data.content.masks[0];
                const maskSrc = `data:image/png;base64,${base64}`;
                setMask(maskSrc);
                const maskImage = new Image();
                maskImage.src = maskSrc;

                maskImage.onload = () => {
                    const canvas = canvasRef.current;
                    const ctx = canvas?.getContext("2d");
                    if (!canvas || !ctx) return;

                    ctx.globalAlpha = 0.4;
                    ctx.drawImage(maskImage, 0, 0, canvas.width, canvas.height);
                    ctx.globalAlpha = 1;
                    setIsLoading(false);
                };
            } catch (error) {
                console.error(error);
                setIsLoading(false);
            }
        });
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        const newImg = new Image();

        newImg.src = uploadedImage;
        newImg.onload = () => {
            setImg(newImg);
        };
    }, [uploadedImage]);

    useEffect(() => {
        if (img && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            const containerWidth =
                canvas.parentElement?.offsetWidth || img.width;
            const containerHeight =
                (containerWidth / img.width) * img.height || img.height;

            canvas.width = containerWidth;
            canvas.height = containerHeight;

            ctx.drawImage(img, 0, 0, containerWidth, containerHeight);
            drawAnnotations(ctx);

            if (mask) {
                const maskImage = new Image();
                maskImage.src = mask;

                maskImage.onload = () => {
                    ctx.globalAlpha = 0.4;
                    ctx.drawImage(maskImage, 0, 0, canvas.width, canvas.height);
                    ctx.globalAlpha = 1;
                };
            }
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [img, points, boxes, negativePoints, currentBox, mask]);

    useEffect(() => {
        handleSubmit();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [points, boxes, negativePoints]);

    const drawAnnotations = (ctx: CanvasRenderingContext2D) => {
        points.forEach((point) => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
            ctx.fillStyle = "aqua";
            ctx.fill();
        });

        negativePoints.forEach((point) => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
            ctx.fillStyle = "red";
            ctx.fill();
        });

        [...boxes, currentBox].filter(Boolean).forEach((box) => {
            if (!box) return;
            ctx.beginPath();
            ctx.strokeStyle = "green";
            ctx.lineWidth = 2;
            ctx.strokeRect(box.startX, box.startY, box.width, box.height);
        });
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (mode !== "point") return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const nearbyPointIndex = findNearbyPoint(points, x, y, 15);
        if (nearbyPointIndex === -1) {
            setPoints([...points, { x, y }]);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) {
            handleImageUpload(file);
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setName(file.name);
            handleImageUpload(file);
        }
    };

    const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
        e.preventDefault();

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const nearbyPointIndex = findNearbyPoint(points, x, y);

        const boxIndex =
            mode === "box"
                ? boxes.findIndex(
                      (box) =>
                          x >= box.startX &&
                          x <= box.startX + box.width &&
                          y >= box.startY &&
                          y <= box.startY + box.height
                  )
                : -1;

        if (nearbyPointIndex !== -1) {
            const newPoints = [...points];
            newPoints.splice(nearbyPointIndex, 1);
            setPoints(newPoints);
        } else if (boxIndex !== -1) {
            const newBoxes = [...boxes];
            newBoxes.splice(boxIndex, 1);
            setBoxes(newBoxes);
        } else {
            const nearbyNegativePointIndex = findNearbyPoint(
                negativePoints,
                x,
                y
            );
            if (nearbyNegativePointIndex !== -1) {
                const newNegativePoints = [...negativePoints];
                newNegativePoints.splice(nearbyNegativePointIndex, 1);
                setNegativePoints(newNegativePoints);
            } else {
                setNegativePoints([...negativePoints, { x, y }]);
            }
        }
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (mode !== "box") return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setIsDrawing(true);
        setCurrentBox({ startX: x, startY: y, width: 0, height: 0 });
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !currentBox) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setCurrentBox({
            ...currentBox,
            width: x - currentBox.startX,
            height: y - currentBox.startY,
        });
    };

    const handleMouseUp = () => {
        if (currentBox) {
            setBoxes([...boxes, currentBox]);
        }
        setIsDrawing(false);
        setCurrentBox(null);
    };

    const clear = () => {
        setPoints([]);
        setNegativePoints([]);
        setBoxes([]);
        setMask(null);
    };

    const findNearbyPoint = (
        points: Point[],
        x: number,
        y: number,
        threshold: number = 10
    ): number => {
        return points.findIndex((point) => {
            const distance = Math.sqrt(
                Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2)
            );
            return distance <= threshold;
        });
    };

    function downloadMask() {
        if (!mask) return alert("No mask to download");
        const downloadLink = document.createElement("a");
        downloadLink.href = mask!;
        downloadLink.download = !name
            ? "mask.png"
            : name.replace(/\.(?=[^.]*$)/, "_mask.");
        downloadLink.click();
    }

    return (
        <div className="min-h-screen bg-gray-50 py-4">
            <div className="max-w-6xl mx-auto px-4">
                <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className={`border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer ${
                        uploadedImage ? "hidden" : ""
                    }`}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileInput}
                        className="hidden"
                        id="fileInput"
                    />
                    <label htmlFor="fileInput" className="cursor-pointer">
                        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <p className="text-lg font-medium text-gray-600">
                            Drag and drop an image here, or click to select
                        </p>
                        <p className="text-sm text-gray-400 mt-2">
                            Supports: JPG, PNG, GIF
                        </p>
                    </label>
                </div>
                <div className="w-full mt-4">
                    <div className="flex justify-between">
                        <div className="mb-4 space-x-2 flex justify-center">
                            <button
                                className={`flex items-center px-4 py-2 rounded hover:bg-blue-600 hover:text-white ${
                                    mode === "point"
                                        ? "bg-blue-500 text-white"
                                        : "bg-gray-200"
                                }`}
                                onClick={() => setMode("point")}
                            >
                                Point Mode <Dot className="h-5 w-5 ml-2" />
                            </button>
                            <button
                                className={`flex items-center px-4 py-2 rounded hover:bg-blue-600 hover:text-white ${
                                    mode === "box"
                                        ? "bg-blue-500 text-white"
                                        : "bg-gray-200"
                                }`}
                                onClick={() => setMode("box")}
                            >
                                Box Mode <Square className="h-5 w-5 ml-2" />
                            </button>
                            <button
                                onClick={clear}
                                className="flex items-center px-4 py-2 rounded bg-gray-200 hover:bg-blue-600 hover:text-white transition-colors"
                            >
                                Clear <Eraser className="h-5 w-5 ml-2" />
                            </button>
                        </div>
                        <div className="mb-4 space-x-2 flex justify-center">
                            <button
                                onClick={downloadMask}
                                className="flex items-center px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                            >
                                Download Mask{" "}
                                <ImageDown className="h-5 w-5 ml-2" />
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="flex items-center px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                            >
                                Submit <Send className="h-5 w-5 ml-2" />
                            </button>
                            <button
                                onClick={() => inputRef.current?.click()}
                                className="flex items-center px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                            >
                                Upload Image{" "}
                                <ImageUp className="h-5 w-5 ml-2" />
                            </button>
                        </div>
                    </div>
                    <div className="relative w-full h-full mx-auto">
                        <canvas
                            ref={canvasRef}
                            onClick={handleCanvasClick}
                            onContextMenu={handleContextMenu}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            className="w-full h-full border border-gray-300 rounded-lg cursor-crosshair"
                        />

                        {isLoading && (
                            <div className="absolute top-2 right-2 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
