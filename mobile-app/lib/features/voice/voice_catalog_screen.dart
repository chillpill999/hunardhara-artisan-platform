import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../review/review_catalog_screen.dart';

class VoiceCatalogScreen extends StatefulWidget {
  final String capturedImagePath;

  const VoiceCatalogScreen({Key? key, required this.capturedImagePath}) : super(key: key);

  @override
  State<VoiceCatalogScreen> createState() => _VoiceCatalogScreenState();
}

class _VoiceCatalogScreenState extends State<VoiceCatalogScreen> {
  bool _isRecording = false;
  int _recordingSeconds = 0;
  String _selectedLanguage = 'हिन्दी (Hindi)';

  void _toggleRecording() {
    setState(() {
      _isRecording = !_isRecording;
    });

    if (!_isRecording) {
      // Finished speaking, simulate AI parsing and navigate to review
      Future.delayed(const Duration(milliseconds: 600), () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => const ReviewCatalogScreen(),
          ),
        );
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppConstants.warmBackground,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppConstants.darkStone),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Step 2: Speak / बोलिए',
          style: TextStyle(color: AppConstants.darkStone, fontWeight: FontWeight.bold, fontSize: 16),
        ),
        centerTitle: true,
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Instructions card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.orange.shade50,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.orange.shade200),
              ),
              child: Column(
                children: [
                  Row(
                    children: const [
                      Icon(Icons.record_voice_over, color: AppConstants.primaryOrange, size: 20),
                      SizedBox(width: 8),
                      Text(
                        'Describe Your Craft / अपनी वस्तु के बारे में बताएं',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppConstants.darkStone),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Tell us: What is it made of? How many days did it take? What raw materials did you use?\n'
                    '(बताएं: यह किस चीज़ से बना है? कितना समय लगा? कौन सा कच्चा माल लगा?)',
                    style: TextStyle(fontSize: 12, color: Colors.black87, height: 1.4),
                  ),
                ],
              ),
            ),

            // Language Chip
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.stone.shade300),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.language, size: 16, color: AppConstants.amberGold),
                  const SizedBox(width: 6),
                  Text(
                    _selectedLanguage,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppConstants.darkStone),
                  ),
                ],
              ),
            ),

            // Central Mic Button with Wave Animation Simulation
            Column(
              children: [
                GestureDetector(
                  onTap: _toggleRecording,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    width: _isRecording ? 130 : 110,
                    height: _isRecording ? 130 : 110,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _isRecording ? Colors.red.shade600 : AppConstants.primaryOrange,
                      boxShadow: [
                        BoxShadow(
                          color: (_isRecording ? Colors.red : AppConstants.primaryOrange).withOpacity(0.4),
                          blurRadius: _isRecording ? 30 : 15,
                          spreadRadius: _isRecording ? 10 : 2,
                        ),
                      ],
                    ),
                    child: Center(
                      child: Icon(
                        _isRecording ? Icons.stop : Icons.mic,
                        color: Colors.white,
                        size: 52,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  _isRecording ? 'Listening... Tap to finish / सुन रहे हैं... टैप करें' : 'Tap to Speak / बोलने के लिए टैप करें',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: _isRecording ? Colors.red.shade700 : AppConstants.darkStone,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Bhashini Indic AI converts your speech directly to e-commerce catalog',
                  style: TextStyle(fontSize: 11, color: Colors.stone),
                  textAlign: TextAlign.center,
                ),
              ],
            ),

            // Bottom skip/direct proceed button
            TextButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const ReviewCatalogScreen(),
                  ),
                );
              },
              child: const Text(
                'Skip to manual review / समीक्षा पर जाएं →',
                style: TextStyle(color: AppConstants.primaryOrange, fontWeight: FontWeight.bold, fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
