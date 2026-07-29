import appJson from '../../app.json';

describe('native Solis brand configuration', () => {
  it('uses the delivered official assets across app targets', () => {
    const { expo } = appJson;

    expect(expo.icon).toBe('./assets/brand/solis-app-icon.png');
    expect(expo.ios.icon).toBe('./assets/brand/solis-app-icon.png');
    expect(expo.android.icon).toBe('./assets/brand/solis-app-icon.png');
    expect(expo.android.adaptiveIcon).toEqual({
      backgroundColor: '#082868',
      foregroundImage: './assets/brand/solis-symbol.png',
      monochromeImage: './assets/brand/solis-adaptive-icon-monochrome.png',
    });
    expect(expo.splash).toEqual({
      backgroundColor: '#082868',
      image: './assets/brand/solis-splash-icon.png',
      resizeMode: 'contain',
    });
    expect(expo.web.favicon).toBe('./assets/brand/solis-symbol.png');
  });
});
