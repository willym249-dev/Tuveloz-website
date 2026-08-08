import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Build variants let development, internal preview builds and the store build
 * live on the same device at the same time. Select one with APP_VARIANT, e.g.
 *
 *   APP_VARIANT=preview npx expo start
 *
 * Anything secret belongs in EAS secrets or a local `.env`, never in here —
 * this file is committed and everything it returns ships inside the binary.
 */
const VARIANTS = {
  development: { label: 'Tuveloz (Dev)', idSuffix: '.dev' },
  preview: { label: 'Tuveloz (Preview)', idSuffix: '.preview' },
  production: { label: 'Tuveloz', idSuffix: '' },
} as const;

type VariantName = keyof typeof VARIANTS;

function resolveVariant(): VariantName {
  const requested = process.env.APP_VARIANT;
  if (requested && requested in VARIANTS) {
    return requested as VariantName;
  }
  if (requested) {
    throw new Error(
      `Unknown APP_VARIANT "${requested}". Expected one of: ${Object.keys(VARIANTS).join(', ')}.`
    );
  }
  return 'development';
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = resolveVariant();
  const { label, idSuffix } = VARIANTS[variant];
  const applicationId = `com.tuveloz.app${idSuffix}`;

  return {
    ...config,
    name: label,
    slug: 'tuveloz-app',
    version: '0.1.0',
    orientation: 'portrait',
    scheme: 'tuveloz',
    userInterfaceStyle: 'light',
    icon: './assets/images/icon.png',
    ios: {
      bundleIdentifier: applicationId,
      supportsTablet: false,
    },
    android: {
      package: applicationId,
      adaptiveIcon: {
        backgroundColor: '#07182D',
        foregroundImage: './assets/images/android-icon-foreground.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#07182D',
          image: './assets/images/splash-icon.png',
          imageWidth: 160,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      variant,
    },
  };
};
