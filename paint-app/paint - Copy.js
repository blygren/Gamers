document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const sizeDisplay = document.getElementById('size-display');
    const brushSizeSlider = document.getElementById('brush-size');
    const colorPicker = document.getElementById('color-picker');
    const clearButton = document.getElementById('clear');
    const saveButton = document.getElementById('save');
    const tools = document.querySelectorAll('.tool');
    const brushes = document.querySelectorAll('.brush');
    const boxIndicator = document.getElementById('box-indicator');
    const imageInput = document.getElementById('image-input');
    
    // Drawing state - MOVED BEFORE resizeCanvas() call
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let currentTool = 'pencil';
    let currentBrush = 'round-brush';
    let currentColor = '#000000';
    let currentSize = 5;
    let dripDrops = [];
    let startDrawPoint = { x: 0, y: 0 };
    let textInput = '';
    let symmetryActive = false;
    let symmetryAxis = 0; // Initialize to 0 and set proper value after canvas is sized
    let stampType = 'star';
    let gradientStartPoint = null;
    let polygonPoints = [];
    let curvePoints = [];
    let gridActive = false;
    let rotationAngle = 0;
    let zoomLevel = 1;
    let selection = null;
    let selectionData = null;
    let mirrorHorizontal = false;
    let cropStart = null;
    let cropEnd = null;
    let rainbowIndex = 0;
    let rainbowColors = [
        '#FF0000', '#FF7F00', '#FFFF00', '#00FF00', 
        '#0000FF', '#4B0082', '#9400D3'
    ];
    
    // Create gridCanvas
    const gridCanvas = document.createElement('canvas');
    gridCanvas.id = 'grid-overlay';
    document.querySelector('.container').appendChild(gridCanvas);
    const gridCtx = gridCanvas.getContext('2d');
    
    // Grid properties
    const gridSize = 20;
    
    // Set canvas size
    function resizeCanvas() {
        canvas.width = window.innerWidth - 250; // Subtract toolbar width
        canvas.height = window.innerHeight;
        
        // Reset symmetry axis after resize
        symmetryAxis = canvas.width / 2;
        
        // Resize grid canvas too
        gridCanvas.width = canvas.width;
        gridCanvas.height = canvas.height;
        gridCanvas.style.left = "250px"; // Match the toolbar width
        
        // Redraw grid if active
        if (gridActive) {
            drawGrid();
        }
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Tool selection
    tools.forEach(tool => {
        tool.addEventListener('click', () => {
            // Reset any ongoing operations
            polygonPoints = [];
            curvePoints = [];
            selection = null;
            cropStart = null;
            cropEnd = null;
            
            tools.forEach(t => t.classList.remove('active'));
            tool.classList.add('active');
            currentTool = tool.id;
            
            if (currentTool === 'image-import') {
                imageInput.click();
            } else if (currentTool === 'grid') {
                toggleGrid();
            } else if (currentTool === 'rotate') {
                rotateCanvas();
            } else if (currentTool === 'mirror-h') {
                toggleHorizontalMirror();
            }
        });
    });
    
    // Brush selection
    brushes.forEach(brush => {
        brush.addEventListener('click', () => {
            brushes.forEach(b => b.classList.remove('active'));
            brush.classList.add('active');
            currentBrush = brush.id;
            // Switch to brush tool when selecting a brush
            tools.forEach(t => t.classList.remove('active'));
            document.getElementById('brush').classList.add('active');
            currentTool = 'brush';
        });
    });
    
    // Update brush size
    brushSizeSlider.addEventListener('input', () => {
        currentSize = brushSizeSlider.value;
        sizeDisplay.textContent = currentSize;
    });
    
    // Update color
    colorPicker.addEventListener('input', () => {
        currentColor = colorPicker.value;
    });
    
    // Clear canvas
    clearButton.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        dripDrops = [];
    });
    
    // Save image
    saveButton.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = 'painting.png';
        link.href = canvas.toDataURL();
        link.click();
    });
    
    // Image import handler
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    // Preserve aspect ratio but fit within canvas
                    const aspectRatio = img.width / img.height;
                    let newWidth = canvas.width * 0.8;
                    let newHeight = newWidth / aspectRatio;
                    
                    if (newHeight > canvas.height * 0.8) {
                        newHeight = canvas.height * 0.8;
                        newWidth = newHeight * aspectRatio;
                    }
                    
                    const x = (canvas.width - newWidth) / 2;
                    const y = (canvas.height - newHeight) / 2;
                    
                    ctx.drawImage(img, x, y, newWidth, newHeight);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Drawing functionality
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    function startDrawing(e) {
        isDrawing = true;
        [lastX, lastY] = [e.offsetX, e.offsetY];
        startDrawPoint = { x: e.offsetX, y: e.offsetY }; // Store start point for shapes
        
        // Special tool handling
        if (['rectangle', 'circle', 'line'].includes(currentTool)) {
            // Just store the starting position
        } else if (currentTool === 'drip') {
            createDripDrop(e.offsetX, e.offsetY);
        } else if (currentTool === 'fill') {
            floodFill(e.offsetX, e.offsetY, currentColor);
        } else if (currentTool === 'text') {
            // Prompt for text input when the text tool is used
            textInput = prompt('Enter text:', '');
            if (textInput) {
                ctx.font = `${currentSize * 2}px Arial`;
                ctx.fillStyle = currentColor;
                ctx.fillText(textInput, e.offsetX, e.offsetY);
            }
        } else if (currentTool === 'stamp') {
            drawStamp(e.offsetX, e.offsetY);
        } else if (currentTool === 'gradient') {
            if (!gradientStartPoint) {
                gradientStartPoint = { x: e.offsetX, y: e.offsetY };
            } else {
                drawGradient(gradientStartPoint, { x: e.offsetX, y: e.offsetY });
                gradientStartPoint = null;
            }
        } else if (currentTool === 'polygon') {
            handlePolygonClick(e.offsetX, e.offsetY);
        } else if (currentTool === 'curve') {
            handleCurveClick(e.offsetX, e.offsetY);
        } else if (currentTool === 'eyedropper') {
            pickColor(e.offsetX, e.offsetY);
        } else if (currentTool === 'select') {
            startSelection(e.offsetX, e.offsetY);
        } else if (currentTool === 'crop') {
            startCrop(e.offsetX, e.offsetY);
        } else if (currentTool === 'triangle-text') {
            drawTriangleWithText(e.offsetX, e.offsetY);
        } else if (currentTool === 'emoji') {
            placeEmoji(e.offsetX, e.offsetY);
        } else if (currentTool === 'zoom') {
            toggleZoom(e.offsetX, e.offsetY);
        } else if (currentTool === 'shape-detect') {
            detectShape(e.offsetX, e.offsetY);
        } else {
            // For pencil, brush, and eraser, start drawing immediately
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(e.offsetX, e.offsetY);
            setContextProperties();
            ctx.stroke();
        }
    }
    
    // Remaining drawing functions
    function draw(e) {
        if (!isDrawing) {
            // Show box indicator when hovering with rectangle tool selected
            if (currentTool === 'rectangle') {
                document.body.style.cursor = 'crosshair';
            } else {
                document.body.style.cursor = 'default';
            }
            return;
        }
        
        if (currentTool === 'rectangle') {
            // Update box indicator
            const width = e.offsetX - startDrawPoint.x;
            const height = e.offsetY - startDrawPoint.y;
            boxIndicator.style.display = 'block';
            boxIndicator.style.left = `${Math.min(startDrawPoint.x, e.offsetX) + 250}px`; // Add toolbar width
            boxIndicator.style.top = `${Math.min(startDrawPoint.y, e.offsetY)}px`;
            boxIndicator.style.width = `${Math.abs(width)}px`;
            boxIndicator.style.height = `${Math.abs(height)}px`;
            boxIndicator.style.borderColor = currentColor;
        } else if (currentTool === 'circle' || currentTool === 'line') {
            // For shapes, we'll preview them on mousemove and draw the final shape on mouseup
        } else if (currentTool === 'pencil') {
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(e.offsetX, e.offsetY);
            setContextProperties();
            ctx.stroke();
            [lastX, lastY] = [e.offsetX, e.offsetY];
            
            // Draw symmetrically if symmetry is active
            if (symmetryActive) {
                const symmetricX = 2 * symmetryAxis - e.offsetX;
                ctx.beginPath();
                ctx.moveTo(2 * symmetryAxis - lastX, lastY);
                ctx.lineTo(symmetricX, e.offsetY);
                setContextProperties();
                ctx.stroke();
            }
            
            // Draw mirrored horizontally if active
            if (mirrorHorizontal) {
                const mirrorY = canvas.height - e.offsetY;
                ctx.beginPath();
                ctx.moveTo(lastX, canvas.height - lastY);
                ctx.lineTo(e.offsetX, mirrorY);
                setContextProperties();
                ctx.stroke();
                
                // Handle both symmetry and mirror
                if (symmetryActive) {
                    const symmetricX = 2 * symmetryAxis - e.offsetX;
                    ctx.beginPath();
                    ctx.moveTo(2 * symmetryAxis - lastX, canvas.height - lastY);
                    ctx.lineTo(symmetricX, mirrorY);
                    setContextProperties();
                    ctx.stroke();
                }
            }
        } else if (currentTool === 'brush') {
            applyBrush(e.offsetX, e.offsetY);
            [lastX, lastY] = [e.offsetX, e.offsetY];
            
            // Draw symmetrically if symmetry is active
            if (symmetryActive) {
                const symmetricX = 2 * symmetryAxis - e.offsetX;
                applyBrush(symmetricX, e.offsetY);
            }
            
            // Draw mirrored horizontally if active
            if (mirrorHorizontal) {
                applyBrush(e.offsetX, canvas.height - e.offsetY);
                
                // Handle both symmetry and mirror
                if (symmetryActive) {
                    const symmetricX = 2 * symmetryAxis - e.offsetX;
                    applyBrush(symmetricX, canvas.height - e.offsetY);
                }
            }
        } else if (currentTool === 'eraser') {
            ctx.beginPath();
            ctx.arc(e.offsetX, e.offsetY, currentSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.fill();
            [lastX, lastY] = [e.offsetX, e.offsetY];
        } else if (currentTool === 'drip') {
            // Create drip spots occasionally while moving
            if (Math.random() < 0.1) {
                createDripDrop(e.offsetX, e.offsetY);
            }
        } else if (currentTool === 'blur') {
            applyBlurEffect(e.offsetX, e.offsetY);
        } else if (currentTool === 'rainbow') {
            applyRainbowBrush(e.offsetX, e.offsetY);
        } else if (currentTool === 'neon') {
            applyNeonEffect(e.offsetX, e.offsetY);
        } else if (currentTool === 'select' && selection) {
            // Move selection preview
            selection.x = e.offsetX - (startDrawPoint.x - selection.x);
            selection.y = e.offsetY - (startDrawPoint.y - selection.y);
            startDrawPoint.x = e.offsetX;
            startDrawPoint.y = e.offsetY;
        } else if (currentTool === 'crop') {
            updateCropPreview(e.offsetX, e.offsetY);
        }
    }
    
    function stopDrawing(e) {
        if (!isDrawing) return;
        
        if (currentTool === 'rectangle') {
            // Draw rectangle
            const width = e.offsetX - startDrawPoint.x;
            const height = e.offsetY - startDrawPoint.y;
            ctx.beginPath();
            ctx.rect(startDrawPoint.x, startDrawPoint.y, width, height);
            setContextProperties();
            ctx.stroke();
            
            // Hide box indicator
            boxIndicator.style.display = 'none';
        } else if (currentTool === 'circle') {
            // Draw circle
            const radius = Math.sqrt(
                Math.pow(e.offsetX - startDrawPoint.x, 2) + Math.pow(e.offsetY - startDrawPoint.y, 2)
            );
            ctx.beginPath();
            ctx.arc(startDrawPoint.x, startDrawPoint.y, radius, 0, Math.PI * 2);
            setContextProperties();
            ctx.stroke();
        } else if (currentTool === 'line') {
            // Draw line
            ctx.beginPath();
            ctx.moveTo(startDrawPoint.x, startDrawPoint.y);
            ctx.lineTo(e.offsetX, e.offsetY);
            setContextProperties();
            ctx.stroke();
            
            // Draw symmetrically if symmetry is active
            if (symmetryActive) {
                const startSymX = 2 * symmetryAxis - startDrawPoint.x;
                const endSymX = 2 * symmetryAxis - e.offsetX;
                
                ctx.beginPath();
                ctx.moveTo(startSymX, startDrawPoint.y);
                ctx.lineTo(endSymX, e.offsetY);
                setContextProperties();
                ctx.stroke();
            }
            
            // Draw mirrored horizontally if active
            if (mirrorHorizontal) {
                ctx.beginPath();
                ctx.moveTo(startDrawPoint.x, canvas.height - startDrawPoint.y);
                ctx.lineTo(e.offsetX, canvas.height - e.offsetY);
                setContextProperties();
                ctx.stroke();
                
                // Handle both symmetry and mirror
                if (symmetryActive) {
                    const startSymX = 2 * symmetryAxis - startDrawPoint.x;
                    const endSymX = 2 * symmetryAxis - e.offsetX;
                    
                    ctx.beginPath();
                    ctx.moveTo(startSymX, canvas.height - startDrawPoint.y);
                    ctx.lineTo(endSymX, canvas.height - e.offsetY);
                    setContextProperties();
                    ctx.stroke();
                }
            }
        } else if (currentTool === 'symmetry') {
            // Toggle symmetry mode
            symmetryActive = !symmetryActive;
            symmetryAxis = canvas.width / 2; // Default to center
            alert(symmetryActive ? "Symmetry mode enabled (vertical axis at center)" : "Symmetry mode disabled");
        } else if (currentTool === 'select') {
            // Place selection at current position
            placeSelection();
        } else if (currentTool === 'crop') {
            cropEnd = { x: e.offsetX, y: e.offsetY };
            applyCrop();
        }
        
        isDrawing = false;
    }
    
    function setContextProperties() {
        if (currentTool === 'eraser') {
            ctx.strokeStyle = 'white';
        } else if (currentTool === 'rainbow') {
            ctx.strokeStyle = getNextRainbowColor();
        } else {
            ctx.strokeStyle = currentColor;
        }
        ctx.lineWidth = currentSize;
        ctx.lineCap = 'round';
    }
    
    // Define missing functions
    
    // Triangle text tool
    function drawTriangleWithText(x, y) {
        const size = currentSize * 10; // Scale triangle based on brush size
        
        // Draw the triangle
        ctx.beginPath();
        ctx.moveTo(x, y - size/2); // Top point
        ctx.lineTo(x - size/2, y + size/2); // Bottom left
        ctx.lineTo(x + size/2, y + size/2); // Bottom right
        ctx.closePath();
        
        // Fill the triangle
        ctx.fillStyle = currentColor;
        ctx.fill();
        
        // Add the text
        ctx.fillStyle = 'white'; // Text color (white for contrast)
        ctx.font = `${size/5}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Wrap text if needed
        const text = "triangles are dum";
        ctx.fillText(text, x, y + size/10);
    }
    
    // Color cycling for rainbow tool
    function getNextRainbowColor() {
        const color = rainbowColors[rainbowIndex];
        rainbowIndex = (rainbowIndex + 1) % rainbowColors.length;
        return color;
    }
    
    // Rainbow brush
    function applyRainbowBrush(x, y) {
        ctx.fillStyle = getNextRainbowColor();
        ctx.beginPath();
        ctx.arc(x, y, currentSize / 2, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Neon effect
    function applyNeonEffect(x, y) {
        ctx.shadowColor = currentColor;
        ctx.shadowBlur = currentSize;
        ctx.fillStyle = currentColor;
        ctx.beginPath();
        ctx.arc(x, y, currentSize / 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Reset shadow for future operations
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
    }
    
    // Blur/smudge effect
    function applyBlurEffect(x, y) {
        // Get a small region around the cursor
        const radius = currentSize;
        const imageData = ctx.getImageData(x - radius, y - radius, radius * 2, radius * 2);
        
        // Apply a simple blur algorithm
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        // Sample and average nearby pixels
        for (let i = 0; i < data.length; i += 4) {
            const row = Math.floor(i / 4 / width);
            const col = (i / 4) % width;
            
            if (Math.sqrt(Math.pow(row - height/2, 2) + Math.pow(col - width/2, 2)) < radius/2) {
                // Only blur pixels within a circle
                data[i] = (data[i] + data[i+4] + data[i-4] + data[i+width*4] + data[i-width*4]) / 5;
                data[i+1] = (data[i+1] + data[i+5] + data[i-3] + data[i+width*4+1] + data[i-width*4+1]) / 5;
                data[i+2] = (data[i+2] + data[i+6] + data[i-2] + data[i+width*4+2] + data[i-width*4+2]) / 5;
            }
        }
        
        // Put the blurred image data back
        ctx.putImageData(imageData, x - radius, y - radius);
    }
    
    // Toggle grid
    function toggleGrid() {
        gridActive = !gridActive;
        if (gridActive) {
            drawGrid();
            gridCanvas.style.display = 'block';
        } else {
            gridCanvas.style.display = 'none';
        }
    }
    
    // Draw grid
    function drawGrid() {
        gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
        gridCtx.beginPath();
        gridCtx.strokeStyle = '#000000';
        gridCtx.lineWidth = 0.5;
        
        // Draw vertical lines
        for (let x = 0; x <= gridCanvas.width; x += gridSize) {
            gridCtx.moveTo(x, 0);
            gridCtx.lineTo(x, gridCanvas.height);
        }
        
        // Draw horizontal lines
        for (let y = 0; y <= gridCanvas.height; y += gridSize) {
            gridCtx.moveTo(0, y);
            gridCtx.lineTo(gridCanvas.width, y);
        }
        
        gridCtx.stroke();
    }
    
    // Rotate canvas
    function rotateCanvas() {
        rotationAngle = (rotationAngle + 90) % 360;
        
        // Save the current canvas content
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(canvas, 0, 0);
        
        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Rotate and draw
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rotationAngle * Math.PI / 180);
        
        if (rotationAngle === 90 || rotationAngle === 270) {
            ctx.drawImage(tempCanvas, -canvas.height / 2, -canvas.width / 2, canvas.height, canvas.width);
        } else {
            ctx.drawImage(tempCanvas, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
        }
        
        ctx.restore();
    }
    
    // Toggle horizontal mirror
    function toggleHorizontalMirror() {
        mirrorHorizontal = !mirrorHorizontal;
        alert(mirrorHorizontal ? "Horizontal mirror enabled" : "Horizontal mirror disabled");
    }
    
    // Pick color with eyedropper
    function pickColor(x, y) {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const color = `#${pixel[0].toString(16).padStart(2, '0')}${pixel[1].toString(16).padStart(2, '0')}${pixel[2].toString(16).padStart(2, '0')}`;
        colorPicker.value = color;
        currentColor = color;
    }
    
    // Polygon tool
    function handlePolygonClick(x, y) {
        // Add point to polygon
        polygonPoints.push({x, y});
        
        // If we have at least 3 points and clicked near the first point, complete the polygon
        if (polygonPoints.length >= 3) {
            const firstPoint = polygonPoints[0];
            const distance = Math.sqrt(
                Math.pow(x - firstPoint.x, 2) + Math.pow(y - firstPoint.y, 2)
            );
            
            if (distance < 20) {
                // Complete polygon
                drawPolygon();
                polygonPoints = []; // Reset for the next polygon
                return;
            }
        }
        
        // Draw current points and lines
        ctx.fillStyle = currentColor;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
        
        if (polygonPoints.length > 1) {
            // Draw line from previous point
            const prevPoint = polygonPoints[polygonPoints.length - 2];
            ctx.beginPath();
            ctx.moveTo(prevPoint.x, prevPoint.y);
            ctx.lineTo(x, y);
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
    
    function drawPolygon() {
        ctx.beginPath();
        ctx.moveTo(polygonPoints[0].x, polygonPoints[0].y);
        
        for (let i = 1; i < polygonPoints.length; i++) {
            ctx.lineTo(polygonPoints[i].x, polygonPoints[i].y);
        }
        
        ctx.closePath();
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentSize;
        ctx.stroke();
    }
    
    // Curve tool
    function handleCurveClick(x, y) {
        curvePoints.push({x, y});
        
        // Draw control point
        ctx.fillStyle = currentColor;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
        
        if (curvePoints.length === 4) {
            // We have enough points to draw a bezier curve
            drawBezierCurve();
            curvePoints = []; // Reset for the next curve
        }
    }
    
    function drawBezierCurve() {
        ctx.beginPath();
        ctx.moveTo(curvePoints[0].x, curvePoints[0].y);
        ctx.bezierCurveTo(
            curvePoints[1].x, curvePoints[1].y,
            curvePoints[2].x, curvePoints[2].y,
            curvePoints[3].x, curvePoints[3].y
        );
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentSize;
        ctx.stroke();
    }
    
    // Selection tool
    function startSelection(x, y) {
        selection = { x, y, width: 100, height: 100 };
        
        // Store the image data under the selection
        selectionData = ctx.getImageData(x, y, selection.width, selection.height);
        
        // Clear the selection area to indicate it's selected
        ctx.clearRect(x, y, selection.width, selection.height);
        
        // Draw a border around selection
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x, y, selection.width, selection.height);
        ctx.setLineDash([]);
    }
    
    function placeSelection() {
        if (selection && selectionData) {
            // Place the selection at its current position
            ctx.putImageData(selectionData, selection.x, selection.y);
            selection = null;
            selectionData = null;
        }
    }
    
    // Crop tool
    function startCrop(x, y) {
        cropStart = { x, y };
        boxIndicator.style.display = 'block';
        boxIndicator.style.left = `${x + 250}px`; // Add toolbar width
        boxIndicator.style.top = `${y}px`;
        boxIndicator.style.width = '0px';
        boxIndicator.style.height = '0px';
    }
    
    function updateCropPreview(x, y) {
        if (cropStart) {
            const width = x - cropStart.x;
            const height = y - cropStart.y;
            
            boxIndicator.style.left = `${Math.min(cropStart.x, x) + 250}px`; // Add toolbar width
            boxIndicator.style.top = `${Math.min(cropStart.y, y)}px`;
            boxIndicator.style.width = `${Math.abs(width)}px`;
            boxIndicator.style.height = `${Math.abs(height)}px`;
        }
    }
    
    function applyCrop() {
        if (cropStart && cropEnd) {
            // Calculate crop dimensions
            const x = Math.min(cropStart.x, cropEnd.x);
            const y = Math.min(cropStart.y, cropEnd.y);
            const width = Math.abs(cropEnd.x - cropStart.x);
            const height = Math.abs(cropEnd.y - cropStart.y);
            
            if (width > 0 && height > 0) {
                // Get the image data from the crop area
                const croppedData = ctx.getImageData(x, y, width, height);
                
                // Clear canvas and resize it to the crop dimensions
                const oldWidth = canvas.width;
                const oldHeight = canvas.height;
                
                // Draw the cropped image
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.putImageData(croppedData, 0, 0);
            }
            
            // Hide crop preview
            boxIndicator.style.display = 'none';
            cropStart = null;
            cropEnd = null;
        }
    }
    
    // Emoji tool
    function placeEmoji(x, y) {
        const emojis = ['😊', '😂', '😍', '🎨', '🖼️', '🎭', '🎬', '🎮'];
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        
        ctx.font = `${currentSize * 2}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(randomEmoji, x, y);
    }
    
    // Zoom tool
    function toggleZoom(x, y) {
        if (zoomLevel === 1) {
            zoomLevel = 2;
            
            // Save current canvas
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(canvas, 0, 0);
            
            // Clear and zoom
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.scale(zoomLevel, zoomLevel);
            ctx.drawImage(tempCanvas, -x + canvas.width/4, -y + canvas.height/4);
            
            alert("Zoomed in 2x. Click zoom tool again to reset.");
        } else {
            zoomLevel = 1;
            
            // Save current canvas
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(canvas, 0, 0);
            
            // Reset zoom
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.drawImage(tempCanvas, 0, 0);
        }
    }
    
    // Shape detection
    function detectShape(x, y) {
        alert("Shape detection activated! Click on shapes to identify them.");
        // In a real implementation, this would use computer vision to detect shapes
        // For this demo, we'll just place a shape label
        ctx.fillStyle = currentColor;
        ctx.font = `${currentSize}px Arial`;
        ctx.fillText("Shape detected!", x, y);
    }
    
    // Dripping paint feature and other existing functions
    // ... existing code ...
    function createDripDrop(x, y) {
        const drop = {
            x,
            y,
            color: currentColor,
            size: currentSize,
            speed: Math.random() * 2 + 1,
            active: true,
            drips: []
        };
        
        // Initialize with a few drips
        for (let i = 0; i < 3; i++) {
            createDrip(drop);
        }
        
        dripDrops.push(drop);
        
        // Start animating drips if not already running
        if (dripDrops.length === 1) {
            animateDrips();
        }
    }
    
    function createDrip(drop) {
        drop.drips.push({
            x: drop.x + (Math.random() - 0.5) * drop.size,
            y: drop.y,
            length: Math.random() * 10 + 5,
            speed: Math.random() * 2 + 0.5,
            width: Math.random() * (drop.size / 2) + 2,
            active: true
        });
    }
    
    function animateDrips() {
        if (dripDrops.length === 0) return;
        
        ctx.save();
        
        // Process each drop
        dripDrops.forEach((drop, dropIndex) => {
            // Occasionally create new drips
            if (Math.random() < 0.05 && drop.drips.length < 10) {
                createDrip(drop);
            }
            
            // Draw the main drop
            ctx.beginPath();
            ctx.arc(drop.x, drop.y, drop.size / 2, 0, Math.PI * 2);
            ctx.fillStyle = drop.color;
            ctx.fill();
            
            // Process each drip in the drop
            drop.drips.forEach((drip, dripIndex) => {
                if (!drip.active) return;
                
                // Draw the drip
                ctx.beginPath();
                ctx.moveTo(drip.x, drip.y);
                ctx.lineTo(drip.x, drip.y + drip.length);
                ctx.lineWidth = drip.width;
                ctx.strokeStyle = drop.color;
                ctx.stroke();
                
                // Update drip position
                drip.y += drip.speed;
                drip.length += drip.speed / 2;
                
                // Randomly end drips
                if (Math.random() < 0.02 || drip.y > canvas.height) {
                    drip.active = false;
                }
            });
            
            // Remove inactive drips
            drop.drips = drop.drips.filter(drip => drip.active);
            
            // Mark drop as inactive if it has no active drips
            if (drop.drips.length === 0) {
                drop.active = false;
            }
        });
        
        // Remove inactive drops
        dripDrops = dripDrops.filter(drop => drop.active);
        
        ctx.restore();
        
        // Continue animation if there are active drops
        if (dripDrops.length > 0) {
            requestAnimationFrame(animateDrips);
        }
    }
});
