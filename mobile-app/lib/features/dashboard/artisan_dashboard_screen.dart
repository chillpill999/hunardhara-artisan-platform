import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../camera/camera_studio_screen.dart';

class ArtisanDashboardScreen extends StatelessWidget {
  const ArtisanDashboardScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppConstants.warmBackground,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: const [
            Text(
              'Artisan Dashboard / कारीगर डैशबोर्ड',
              style: TextStyle(color: AppConstants.darkStone, fontWeight: FontWeight.bold, fontSize: 16),
            ),
            Text(
              'Bastar Dhokra Cluster • MoSJE Verified',
              style: TextStyle(color: Colors.stone, fontSize: 11),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_none, color: AppConstants.darkStone),
            onPressed: () {},
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Revenue & Metrics Hero
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF7C2D12), Color(0xFFC2410C)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(color: Colors.orange.shade900.withOpacity(0.25), blurRadius: 15, offset: const Offset(0, 6)),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Total Direct Revenue / कुल कमाई', style: TextStyle(color: Colors.white70, fontSize: 12)),
                  const SizedBox(height: 4),
                  const Text('₹48,250', style: TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.extrabold)),
                  const SizedBox(height: 14),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _buildWhiteMetric('14', 'Active Listings'),
                      _buildWhiteMetric('6', 'Orders Received'),
                      _buildWhiteMetric('+68%', 'Margin Uplift'),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Low Stock / Production Capacity Banner
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.amber.shade300),
              ),
              child: Row(
                children: [
                  const Icon(Icons.inventory_2_outlined, color: AppConstants.amberGold, size: 24),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text('Monthly Capacity: 30 units', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppConstants.darkStone)),
                        Text('B2B matchmaking will pool SHG cluster partners for orders above 30 units.', style: TextStyle(fontSize: 11, color: Colors.black87)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Section Header: My Products
            Row(
              mainAxisAlignment: MainAxisAlignment.between,
              children: const [
                Text('My Digital Catalog / मेरी वस्तुएं', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppConstants.darkStone)),
                Text('See All', style: TextStyle(color: AppConstants.primaryOrange, fontWeight: FontWeight.bold, fontSize: 12)),
              ],
            ),
            const SizedBox(height: 14),

            // Sample Product Items
            _buildProductRow(
              title: 'Bastar Dhokra Brass Tribal Horse',
              stock: '4 units left (Low Stock)',
              price: '₹2,850',
              statusColor: Colors.amber.shade800,
            ),
            const SizedBox(height: 10),
            _buildProductRow(
              title: 'Tribal Deer Figurine 12cm',
              stock: '12 units in stock',
              price: '₹1,650',
              statusColor: Colors.green.shade700,
            ),
            const SizedBox(height: 10),
            _buildProductRow(
              title: 'Bastar Musician Statuette Pair',
              stock: '8 units in stock',
              price: '₹3,400',
              statusColor: Colors.green.shade700,
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppConstants.primaryOrange,
        icon: const Icon(Icons.camera_alt, color: Colors.white),
        label: const Text('New Craft / नई वस्तु', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const CameraStudioScreen()),
          );
        },
      ),
    );
  }

  static Widget _buildWhiteMetric(String value, String label) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
        Text(label, style: const TextStyle(color: Colors.white60, fontSize: 10)),
      ],
    );
  }

  static Widget _buildProductRow({required String title, required String stock, required String price, required Color statusColor}) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.stone.shade200),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(color: Colors.orange.shade50, borderRadius: BorderRadius.circular(12)),
            child: const Center(child: Icon(Icons.brush, color: AppConstants.primaryOrange, size: 22)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppConstants.darkStone)),
                const SizedBox(height: 2),
                Text(stock, style: TextStyle(fontSize: 11, color: statusColor, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          Text(price, style: const TextStyle(fontWeight: FontWeight.extrabold, fontSize: 15, color: AppConstants.darkStone)),
        ],
      ),
    );
  }
}
