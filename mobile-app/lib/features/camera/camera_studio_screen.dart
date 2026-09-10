import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../voice/voice_catalog_screen.dart';

class CameraStudioScreen extends StatefulWidget {
  const CameraStudioScreen({Key? key}) : super(key: key);

  @override
  State<CameraStudioScreen> createState() => _CameraStudioScreenState();
}

class _CameraStudioScreenState extends State<CameraStudioScreen> {
  bool _isBlurDetected = false;
  bool _isGoodLighting = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        title: Column(
          children: const [
            Text(
              'Step 1: Snap Photo / फोटो लें',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            Text(
              'Keep craft in the center / वस्तु को बीच में रखें',
              style: TextStyle(fontSize: 11, color: Colors.white70),
            ),
          ],
        ),
        centerTitle: true,
      ),
      body: Stack(
        children: [
          // Viewfinder Camera Simulation
          Center(
            child: Container(
              width: MediaQuery.of(context).size.width * 0.88,
              height: MediaQuery.of(context).size.width * 0.88,
              decoration: BoxDecoration(
                border: Border.all(
                  color: _isBlurDetected ? Colors.red : AppConstants.amberGold,
                  width: 3,
                ),
                borderRadius: BorderRadius.circular(24),
                color: Colors.white10,
              ),
              child: Stack(
                children: [
                  // Center Framing Crosshairs
                  Center(
                    child: Icon(
                      Icons.center_focus_strong,
                      size: 64,
                      color: AppConstants.amberGold.withOpacity(0.6),
                    ),
                  ),

                  // Edge Overlay status pills
                  Positioned(
                    top: 16,
                    left: 16,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: _isGoodLighting ? Colors.black87 : Colors.red.withOpacity(0.8),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            _isGoodLighting ? Icons.wb_sunny : Icons.wb_twilight,
                            size: 14,
                            color: Colors.amber,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            _isGoodLighting ? 'Lighting OK / रोशनी ठीक है' : 'Low Light / कम रोशनी',
                            style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                  ),

                  Positioned(
                    bottom: 16,
                    right: 16,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.black87,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Text(
                        'AI Studio 1:1 Ready',
                        style: TextStyle(color: Colors.greenAccent, fontSize: 10, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Bottom Control Panel with Big Shutter Button
          Positioned(
            bottom: 30,
            left: 0,
            right: 0,
            child: Column(
              children: [
                const Text(
                  'Tap button to capture craft photo',
                  style: TextStyle(color: Colors.white70, fontSize: 12),
                ),
                const SizedBox(height: 16),
                GestureDetector(
                  onTap: () {
                    // Navigate to Step 2: Voice Cataloging
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => const VoiceCatalogScreen(
                          capturedImagePath: 'sample_craft_photo.jpg',
                        ),
                      ),
                    );
                  },
                  child: Container(
                    width: 84,
                    height: 84,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 4),
                      color: AppConstants.primaryOrange,
                      boxShadow: [
                        BoxShadow(
                          color: AppConstants.primaryOrange.withOpacity(0.5),
                          blurRadius: 20,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                    child: const Center(
                      child: Icon(Icons.camera_alt, color: Colors.white, size: 38),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
