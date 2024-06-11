// Set up the scene, camera, and renderer
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
var renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement); // Add renderer to the DOM

// Define the initial distance between the eyes (you can adjust this value)
const initialDistanceBetweenEyes = 100; // Adjust as needed

// Add ambient light
var ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Adjust intensity as needed
scene.add(ambientLight);

// Add directional light
var directionalLight = new THREE.DirectionalLight(0xffffff, 1); // Adjust intensity as needed
directionalLight.position.set(1, 1, 1).normalize();
scene.add(directionalLight);

// Load GLB model
const loader = new THREE.GLTFLoader();
let model;

loader.load('./glbModels/sample.gltf', function (gltf) {
    model = gltf.scene;
    model.scale.set(0.1,0.1,0.1); // Adjust initial scale as needed
    model.rotation.y = Math.PI / 0.2; // Rotate the mesh to face downwards

    
    
    scene.add(model); // Add the model to the scene

    console.log("GLB model loaded successfully");
    console.log("Model position:", model.position);
});

// Set up the camera position and orientation
camera.position.z = 10; // Adjust the camera position to set the distance from the model

// Function to handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize);

// Initialize face detection models
async function initFaceDetection() {
    await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('./models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('./models'),
        faceapi.nets.ageGenderNet.loadFromUri('./models'),
    ]);
}

// Function to animate the scene
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate(); // Start animation loop

// Function to convert screen coordinates to world coordinates
function screenToWorldCoordinates(screenPoint, displaySize) {
    const { width, height } = displaySize;
    const x = (screenPoint.x / width) * 2 - 1;
    const y = -(screenPoint.y / height) * 2 + 1;
    const vector = new THREE.Vector3(x, y, 0.5);
    vector.unproject(camera);
    const dir = vector.sub(camera.position).normalize();
    const distance = -camera.position.z / dir.z;
    return camera.position.clone().add(dir.multiplyScalar(distance));
}

let initialEyeBoundingBoxWidth = 1000;
let initialEyeBoundingBoxHeight = 1000;

// Run the code
async function run() {
    await initFaceDetection();

    // Initialize the webcam and render the video feed
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(function (stream) {
            var video = document.createElement('video');
            video.srcObject = stream;
            video.play();

            // Create a texture to hold the video feed from the webcam
            var videoTexture = new THREE.VideoTexture(video);

            // Create a plane geometry to display the video feed with a smaller size
            var geometry = new THREE.PlaneGeometry(10, 10); // Smaller plane geometry
            var material = new THREE.MeshBasicMaterial({ map: videoTexture, side: THREE.DoubleSide });
            var plane = new THREE.Mesh(geometry, material);

            // Scale the plane
            plane.scale.set(1, 1, 1); // Scale down the plane

            // Position the plane in front of the camera
            plane.position.set(0, 0, -5); // Adjust position as needed
            scene.add(plane);

            video.addEventListener('playing', async () => {
                const displaySize = { width: video.videoWidth, height: video.videoHeight };

                setInterval(async () => {
                    const detections = await faceapi.detectAllFaces(video).withFaceLandmarks();
                  // Inside the block where you're detecting faces and updating the model position
                    if (detections.length > 0 && model) {
                        const detection = detections[0]; // Assume the first face detection is the primary one
                        const leftEye = detection.landmarks.getLeftEye();
                        const rightEye = detection.landmarks.getRightEye();
                        console.log("Face Detected at: ",detection.landmarks.getLeftEye,detection.landmarks.getRightEye)

                    // Calculate the distance between the eyes
                    const distanceBetweenEyes = Math.sqrt(
                        Math.pow(rightEye[0].x - leftEye[5].x, 2) + 
                        Math.pow(rightEye[0].y - leftEye[5].y, 2)
                    );

                    // Calculate the center point between the eyes
                    const centerPoint = {
                        x: (leftEye[0].x + rightEye[0].x) / 2,
                        y: (leftEye[0].y + rightEye[0].y) / 2
                    };

                    // Convert the center point to world coordinates
                    const worldCenterPoint = screenToWorldCoordinates(centerPoint, displaySize);

                    // Position the mesh at the world center point
                    model.position.set(worldCenterPoint.x, worldCenterPoint.y, worldCenterPoint.z);

                    // Calculate the rotation angle based on the direction of the face
                    const deltaY = rightEye[0].y - leftEye[0].y;
                    const deltaX = rightEye[0].x - leftEye[0].x;
                    const angle = Math.atan2(deltaY, deltaX);

                 // Rotate the mesh around the z-axis (yaw)
                    
                }

                }, 100);
            });
        })
        .catch(function (err) {
            console.error('Unable to access the camera.', err);
        });
}

run();
