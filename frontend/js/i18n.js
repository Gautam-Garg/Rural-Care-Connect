// ==============================================================================
// Rural Care Connect: Multilingual Localization Manager (i18n)
// Supports English ('en'), Hindi ('hi'), Marathi ('mr')
// Switches text elements with data-i18n attribute and persists selection.
// ==============================================================================

const I18N = {
  currentLang: localStorage.getItem('ruralcare_lang') || 'en',
  translations: {},

  async init() {
    await this.loadLanguage(this.currentLang);
    this.setupLanguageSwitcher();
    this.setupLowBandwidthMode();
  },

  async loadLanguage(lang) {
    try {
      const res = await fetch(`/locales/${lang}.json`);
      if (res.ok) {
        this.translations[lang] = await res.json();
        this.currentLang = lang;
        localStorage.setItem('ruralcare_lang', lang);
        this.applyTranslations();
      }
    } catch (err) {
      console.warn(`Could not load translations for ${lang}`, err);
    }
  },

  t(key, defaultText = '') {
    const dict = this.translations[this.currentLang] || {};
    return dict[key] || defaultText || key;
  },

  applyTranslations() {
    const dict = this.translations[this.currentLang] || {};
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) {
        el.textContent = dict[key];
      }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (dict[key]) {
        el.setAttribute('placeholder', dict[key]);
      }
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (dict[key]) {
        el.setAttribute('title', dict[key]);
      }
    });
  },

  setupLanguageSwitcher() {
    const select = document.getElementById('lang-select');
    if (select) {
      select.value = this.currentLang;
      select.addEventListener('change', async (e) => {
        await this.loadLanguage(e.target.value);
      });
    }
  },

  setupLowBandwidthMode() {
    const isLow = localStorage.getItem('ruralcare_low_bandwidth') === 'true';
    if (isLow) {
      document.body.classList.add('low-bandwidth');
    }

    const toggle = document.getElementById('toggle-low-bandwidth');
    if (toggle) {
      toggle.checked = isLow;
      toggle.addEventListener('change', (e) => {
        if (e.target.checked) {
          document.body.classList.add('low-bandwidth');
          localStorage.setItem('ruralcare_low_bandwidth', 'true');
        } else {
          document.body.classList.remove('low-bandwidth');
          localStorage.setItem('ruralcare_low_bandwidth', 'false');
        }
      });
    }
  }
};

// Auto initialize on load
document.addEventListener('DOMContentLoaded', () => {
  I18N.init();
});
