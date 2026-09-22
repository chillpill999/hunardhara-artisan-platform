import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:record/record.dart';
import '../../core/constants.dart';
import '../../core/api_service.dart';
import '../../core/offline_database.dart';
import '../review/review_catalog_screen.dart';

class VoiceCatalogScreen extends StatefulWidget {
  final File capturedImageFile;

  const VoiceCatalogScreen({Key? key, required this.capturedImageFile}) : super(key: key);

  @override
  State<VoiceCatalogScreen> createState() => _VoiceCatalogScreenState();
}

class _VoiceCatalogScreenState extends State<VoiceCatalogScreen> {
  final AudioRecorder _audioRecorder = AudioRecorder();
  final ApiService _apiService = ApiService();

  bool _isRecording = false;
  int _recordingSeconds = 0;
  Timer? _timer;
  File? _recordedAudioFile;
  bool _isProcessing = false;
  String _processingStage = '';

  String _selectedLanguage = 'हिन्दी (Hindi)';
  String _selectedLanguageCode = 'hi';

  final List<Map<String, String>> _languages = [
    {'name': 'हिन्दी (Hindi)', 'code': 'hi'},
    {'name': 'English', 'code': 'en'},
    {'name': 'বাংলা (Bengali)', 'code': 'bn'},
    {'name': 'मराठी (Marathi)', 'code': 'mr'},
    {'name': 'తెలుగు (Telugu)', 'code': 'te'},
    {'name': 'தமிழ் (Tamil)', 'code': 'ta'},
    {'name': 'ಕನ್ನಡ (Kannada)', 'code': 'kn'},
  ];

  @override
  void dispose() {
    _timer?.cancel();
    _audioRecorder.dispose();
    super.dispose();
  }

  Future<void> _toggleRecording() async {
    if (_isRecording) {
      // Stop Recording
      _timer?.cancel();
      try {
        final path = await _audioRecorder.stop();
        setState(() {
          _isRecording = false;
          if (path != null) {
            _recordedAudioFile = File(path);
          }
        });
        if (_recordedAudioFile != null && _recordedAudioFile!.existsSync()) {
          _executeCatalogPipeline();
        }
      } catch (e) {
        setState(() => _isRecording = false);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Audio recording failed: $e. Please try recording again.'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } else {
      // Start Recording
      try {
        if (await _audioRecorder.hasPermission()) {
          final tempDir = Directory.systemTemp;
          final filePath = '${tempDir.path}/craft_voice_${DateTime.now().millisecondsSinceEpoch}.m4a';

          await _audioRecorder.start(
            const RecordConfig(encoder: AudioEncoder.aacLc),
            path: filePath,
          );

          setState(() {
            _isRecording = true;
            _recordingSeconds = 0;
          });

          _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
            setState(() {
              _recordingSeconds++;
            });
          });
        } else {
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Microphone permission is required to record your voice description.'),
              backgroundColor: Colors.red,
            ),
          );
        }
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Audio recorder error: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _executeCatalogPipeline() async {
    if (_recordedAudioFile == null || !_recordedAudioFile!.existsSync()) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please record your craft voice description first.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() {
      _isProcessing = true;
      _processingStage = '1. Enhancing Photo in AI Studio (1:1 matting & shadows)...';
    });

    try {
      // Stage 1: Upload and process photo in Studio service
      Map<String, dynamic> studioResult = {};
      try {
        studioResult = await _apiService.uploadStudioPhoto(
          imageFile: widget.capturedImageFile,
          token: AppConstants.defaultDemoToken,
        );
      } catch (studioError) {
        debugPrint('Studio enhancement unavailable: $studioError');
      }

      setState(() {
        _processingStage = '2. Transcribing Indic Speech & Extracting Craft Attributes...';
      });

      // Stage 2: Voice Cataloging via Bhashini/Sarvam
      Map<String, dynamic> voiceResult;
      try {
        voiceResult = await _apiService.uploadVoiceCatalog(
          audioFile: _recordedAudioFile!,
          languageCode: _selectedLanguageCode,
          token: AppConstants.defaultDemoToken,
        );
      } catch (voiceError) {
        setState(() => _isProcessing = false);
        if (!mounted) return;
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Voice Processing Failed / वॉइस त्रुटि'),
            content: Text(
              'Could not process your voice recording with AI services: $voiceError\n\nPlease check your internet connection and try recording again.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('OK'),
              ),
            ],
          ),
        );
        return;
      }

      setState(() {
        _processingStage = '3. Calculating Fair Wage Guardrails & Price Distribution...';
      });

      await Future.delayed(const Duration(milliseconds: 400));

      setState(() {
        _isProcessing = false;
      });

      // Extract real catalog values from AI service response
      final titleEn = voiceResult['title']?.toString() ??
          voiceResult['title_en']?.toString() ??
          'Handcrafted Craft Item';
      final titleHi = voiceResult['title_hi']?.toString() ?? 'हस्तनिर्मित शिल्प';
      final craftType = voiceResult['craft_type']?.toString() ?? 'Handicrafts';
      final materials = voiceResult['materials'] is List
          ? (voiceResult['materials'] as List).join(', ')
          : (voiceResult['materials']?.toString() ?? 'Traditional Materials');
      final daysOfLabor = (voiceResult['production_days'] is int)
          ? voiceResult['production_days'] as int
          : 1;

      final pricing = voiceResult['pricing'] is Map ? voiceResult['pricing'] as Map<String, dynamic> : voiceResult;
      final floorPrice = (pricing['cost_estimate'] is num)
          ? (pricing['cost_estimate'] as num).toDouble()
          : ((pricing['cost_floor'] is num)
              ? (pricing['cost_floor'] as num).toDouble()
              : (pricing['floor_price'] is num ? (pricing['floor_price'] as num).toDouble() : 0.0));
      final recommendedPrice = (pricing['recommended_price'] is num)
          ? (pricing['recommended_price'] as num).toDouble()
          : ((pricing['suggested_retail_max'] is num)
              ? (pricing['suggested_retail_max'] as num).toDouble()
              : (pricing['retail_price'] is num ? (pricing['retail_price'] as num).toDouble() : floorPrice));
      final wholesalePrice = (pricing['wholesale_price'] is num)
          ? (pricing['wholesale_price'] as num).toDouble()
          : ((pricing['suggested_wholesale'] is num)
              ? (pricing['suggested_wholesale'] as num).toDouble()
              : floorPrice);

      final studioImageUrl = studioResult['studio_image_url']?.toString() ?? '';
      final previewUrl = studioResult['before_after_preview_url']?.toString() ?? '';

      // Navigate to Step 3: Review Catalog
      if (!mounted) return;
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => ReviewCatalogScreen(
            rawPhotoFile: widget.capturedImageFile,
            studioImageUrl: studioImageUrl,
            beforeAfterPreviewUrl: previewUrl,
            titleEn: titleEn,
            titleHi: titleHi,
            craftType: craftType,
            materials: materials,
            daysOfLabor: daysOfLabor,
            floorPrice: floorPrice,
            recommendedRetailPrice: recommendedPrice,
            wholesalePrice: wholesalePrice,
            shortDescription: voiceResult['short_description']?.toString() ?? '',
            longDescription: voiceResult['long_description']?.toString() ?? '',
          ),
        ),
      );
    } catch (e) {
      setState(() => _isProcessing = false);
      if (!mounted) return;
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Catalog Processing Error / त्रुटि'),
          content: Text(
            'Failed to process craft catalog with backend services: $e\n\nPlease check your network connection and try again.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('OK'),
            ),
          ],
        ),
      );
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
      body: Stack(
        children: [
          Padding(
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

                // Language Selection Dropdown / Chip
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.stone300),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _selectedLanguageCode,
                      icon: const Icon(Icons.language, size: 18, color: AppConstants.amberGold),
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppConstants.darkStone),
                      onChanged: (String? newCode) {
                        if (newCode != null) {
                          setState(() {
                            _selectedLanguageCode = newCode;
                            _selectedLanguage = _languages.firstWhere((l) => l['code'] == newCode)['name']!;
                          });
                        }
                      },
                      items: _languages.map<DropdownMenuItem<String>>((Map<String, String> lang) {
                        return DropdownMenuItem<String>(
                          value: lang['code'],
                          child: Text(lang['name']!),
                        );
                      }).toList(),
                    ),
                  ),
                ),

                // Central Mic Button with Wave Animation
                Column(
                  children: [
                    GestureDetector(
                      onTap: _isProcessing ? null : _toggleRecording,
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
                      _isRecording
                          ? 'Listening... 0:0${_recordingSeconds}s (Tap to Finish)'
                          : 'Tap to Speak / बोलने के लिए टैप करें',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: _isRecording ? Colors.red.shade700 : AppConstants.darkStone,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Bhashini Indic AI converts your speech directly to e-commerce catalog',
                      style: TextStyle(fontSize: 11, color: AppColors.stone500),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Multi-Step AI Pipeline Processing Modal Overlay
          if (_isProcessing)
            Container(
              color: Colors.black54,
              child: Center(
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 32),
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const CircularProgressIndicator(color: AppConstants.primaryOrange),
                      const SizedBox(height: 20),
                      const Text(
                        'AI Orchestrator Running...',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppConstants.darkStone),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _processingStage,
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 12, color: AppColors.stone600),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
