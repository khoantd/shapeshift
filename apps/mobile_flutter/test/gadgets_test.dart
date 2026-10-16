import 'package:flutter_test/flutter_test.dart';
import 'package:meanbox/gadgets/gadgets.dart';

void main() {
  test('tip calculator', () {
    final r = resolveQuickGadget('tip 18% on \$70', QuickGadgetIntent.tip);
    expect(r, isNotNull);
    expect(r!.ready, isTrue);
    expect(r.intent, QuickGadgetIntent.tip);
    expect(r.copyText, contains('Bill'));
  });

  test('split bill', () {
    final r = resolveQuickGadget('split \$40 for 3', QuickGadgetIntent.split);
    expect(r!.ready, isTrue);
    expect(r.amount, contains('\$'));
  });

  test('convert km to mi', () {
    final r = resolveQuickGadget('10 km to mi', QuickGadgetIntent.convert);
    expect(r!.ready, isTrue);
    expect(r.amount, contains('mi'));
  });

  test('timer', () {
    final r = resolveQuickGadget('25 min focus', QuickGadgetIntent.timer);
    expect(r!.ready, isTrue);
    expect(r.timerSeconds, 25 * 60);
  });

  test('rtcfc labeled', () {
    final r = resolveQuickGadget(
      'Role: eng. Task: review. Context: api. Format: list. Constraints: none.',
      QuickGadgetIntent.rtcfc,
    );
    expect(r!.ready, isTrue);
    expect(r.rtcfc?.role, 'eng');
  });
}
