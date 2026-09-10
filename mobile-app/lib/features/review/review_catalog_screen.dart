import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../dashboard/artisan_dashboard_screen.dart';

class ReviewCatalogScreen extends StatefulWidget {
  const ReviewCatalogScreen({Key? key}) : super(key: key);

  @override
  State<ReviewCatalogScreen> createState() => _ReviewCatalogScreenState();
}

class _ReviewCatalogScreenState extends State<ReviewCatalogScreen> {
  bool _showOriginal = false;
  double _selectedPrice = 2850.0;
  bool _isPublishing = false;

  // Extracted Sample Data
  String _titleEn = 'Bastar Dhokra Brass Tribal Horse';
  String _titleHi = 'बस्तर ढोकरा पीतल का जनजातीय घोड़ा';
  String _craft = 'Bastar Dhokra (Lost-Wax Casting)';
  String _materials = 'Brass, Bell Metal, Natural Beeswax';
  int _days = 4;
  double _floorPrice = 1674.0;
  double _recommendedPrice = 2850.0;
  double _wholesalePrice = 2090.0;

  void _publishProduct() {
    setState(() => _isPublishing = true);

    Future.delayed(const Duration(milliseconds: 900), () {
      setState(() => _isPublishing = false);
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: Row(
            children: const [
              Icon(Icons.check_circle, color: Colors.green, size: 28),
              SizedBox(width: 8),
              Text('Published! / प्रकाशित!'),
            ],
          ),
          content: const Text(
            'Your handicraft has been cataloged and broadcasted to the ONDC Network and HunarSetu Marketplace.',
            style: TextStyle(fontSize: 13),
          ),
          actions: [
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppConstants.primaryOrange,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () {
                Navigator.pop(context); // Close dialog
                Navigator.pushAndRemoveUntil(
                  context,
                  MaterialPageRoute(builder: (context) => const ArtisanDashboardScreen()),
                  (route) => false,
                );
              },
              child: const Text('Go to Dashboard / डैशबोर्ड पर जाएं', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppConstants.warmBackground,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Step 3: Review & Sell / समीक्षा व बिक्री',
          style: TextStyle(color: AppConstants.darkStone, fontWeight: FontWeight.bold, fontSize: 16),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Before vs After Studio Card
            Container(
              height: 240,
              width: double.infinity,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(24),
                color: Colors.white,
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 10, offset: const Offset(0, 4)),
                ],
              ),
              child: Stack(
                children: [
                  Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.palette,
                          size: 72,
                          color: _showOriginal ? Colors.grey : AppConstants.primaryOrange,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          _showOriginal ? 'Raw Cluttered Photo (Before)' : 'AI Studio Photo 1:1 (After)',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                        Text(
                          _showOriginal ? 'Unedited domestic background' : 'RMBG-1.4 Matting + OpenCV Contact Shadow',
                          style: const TextStyle(color: Colors.grey, fontSize: 11),
                        ),
                      ],
                    ),
                  ),

                  // Switcher pill
                  Positioned(
                    bottom: 12,
                    right: 12,
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.black87,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          GestureDetector(
                            onTap: () => setState(() => _showOriginal = false),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: !_showOriginal ? AppConstants.primaryOrange : Colors.transparent,
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: const Text('AI Enhanced', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                            ),
                          ),
                          GestureDetector(
                            onTap: () => setState(() => _showOriginal = true),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: _showOriginal ? Colors.white24 : Colors.transparent,
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: const Text('Original', style: TextStyle(color: Colors.white70, fontSize: 11)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // AI Generated Bilingual Title & Audio Listen
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.stone.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.between,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: Colors.orange.shade50, borderRadius: BorderRadius.circular(8)),
                        child: const Text('AUTO-GENERATED CATALOG', style: TextStyle(color: AppConstants.primaryOrange, fontSize: 9, fontWeight: FontWeight.bold)),
                      ),
                      IconButton(
                        icon: const Icon(Icons.volume_up, color: AppConstants.amberGold, size: 20),
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Playing Bhashini Hindi audio preview...')),
                          );
                        },
                      ),
                    ],
                  ),
                  Text(_titleEn, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppConstants.darkStone)),
                  const SizedBox(height: 2),
                  Text(_titleHi, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13, color: Colors.stone)),
                  const SizedBox(height: 12),

                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      _buildChip(Icons.brush, _craft),
                      _buildChip(Icons.construction, _materials),
                      _buildChip(Icons.timer, '$_days Days of Labor'),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Smart Pricing Section with statutory wage protection
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.amber.shade50.withOpacity(0.5),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.amber.shade300),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.between,
                    children: [
                      const Text(
                        'Smart Pricing Assistant',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppConstants.darkStone),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: Colors.green.shade100, borderRadius: BorderRadius.circular(8)),
                        child: const Text('FAIR WAGE PROTECTED', style: TextStyle(color: Colors.green, fontSize: 9, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _buildPriceBadge('Cost-Plus Floor', '₹${_floorPrice.toInt()}', Colors.stone),
                      _buildPriceBadge('Recommended Retail', '₹${_recommendedPrice.toInt()}', AppConstants.primaryOrange),
                      _buildPriceBadge('Wholesale B2B', '₹${_wholesalePrice.toInt()}', Colors.blue.shade700),
                    ],
                  ),
                  const SizedBox(height: 14),

                  Text(
                    'Your Selling Price: ₹${_selectedPrice.toInt()}',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppConstants.darkStone),
                  ),
                  Slider(
                    value: _selectedPrice,
                    min: _floorPrice,
                    max: 4500.0,
                    divisions: 30,
                    activeColor: AppConstants.primaryOrange,
                    inactiveColor: Colors.stone.shade300,
                    onChanged: (val) => setState(() => _selectedPrice = val),
                  ),
                  Text(
                    'Minimum floor price guaranteed at ₹${_floorPrice.toInt()} based on 4 days of labor under MoSJE statutory daily rates.',
                    style: TextStyle(fontSize: 10, color: Colors.stone.shade600),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),

            // One-Tap Publish Button
            SizedBox(
              width: double.infinity,
              height: 54,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppConstants.primaryOrange,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 2,
                ),
                onPressed: _isPublishing ? null : _publishProduct,
                child: _isPublishing
                  ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: const [
                        Icon(Icons.cloud_upload, color: Colors.white, size: 20),
                        SizedBox(width: 8),
                        Text(
                          'Publish Product / प्रकाशित करें',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                      ],
                    ),
              ),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  Widget _buildChip(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: Colors.stone.shade100, borderRadius: BorderRadius.circular(8)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: AppConstants.darkStone),
          const SizedBox(width: 4),
          Text(text, style: const TextStyle(fontSize: 11, color: AppConstants.darkStone, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  Widget _buildPriceBadge(String label, String value, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 10, color: Colors.stone)),
        const SizedBox(height: 2),
        Text(value, style: TextStyle(fontSize: 15, fontWeight: FontWeight.extrabold, color: color)),
      ],
    );
  }
}
