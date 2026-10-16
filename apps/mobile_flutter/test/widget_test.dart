import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:meanbox/main.dart';

void main() {
  testWidgets('MeanboxApp builds', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: MeanboxApp()));
    await tester.pumpAndSettle();
    expect(find.text('Ask'), findsWidgets);
  });
}
