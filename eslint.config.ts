import antfu from '@antfu/eslint-config'

export default antfu({
  // Справочная разведка цитирует внешние системы: неполные фрагменты JSON,
  // конфиги Valve в формате KeyValues. Это не наш код, и парсер его ломает.
  ignores: ['docs/research/**'],
  rules: {
    'no-console': 'off',
  },
})
