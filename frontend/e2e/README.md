# E2E (Maestro)

Unit tests (`npm test`) cover pure logic and single components. These flows cover
the paths a user actually walks through, on a real device or emulator.

## Ажиллуулах

```bash
# нэг удаа: https://maestro.mobile.dev
curl -Ls "https://get.maestro.mobile.dev" | bash

# dev build эсвэл release суулгасан төхөөрөмж дээр
maestro test frontend/e2e/flows/practice.yaml
maestro test frontend/e2e/flows/exam.yaml
maestro test frontend/e2e/flows            # бүгдийг
```

## Урьдчилсан нөхцөл

- Апп суусан байх (`npx expo run:android` эсвэл EAS build).
- **Google-ээр нэг удаа гараар нэвтэрсэн** байх: Google-ийн нэвтрэх дэлгэц нь
  системийн webview учир Maestro-гоор автоматжуулахад найдваргүй. Флоу бүр
  нэвтэрсэн төлөвөөс эхэлдэг.
- Онбординг дууссан байх (эсвэл эхний ажиллуулалтад `onboarding-skip` дарагдана).

Флоунууд нь `testID` дээр тулгуурладаг тул текст өөрчлөгдөхөд эвдрэхгүй.
