'use client';

import React from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Box,
  Typography,
} from '@mui/material';
import { Language as LanguageIcon } from '@mui/icons-material';

interface Language {
  code: string;
  name: string;
  nativeName: string;
}

const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
];

interface LanguageSelectorProps {
  variant?: 'full' | 'compact';
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'full',
}) => {
  const router = useRouter();
  const { t } = useTranslation('common');
  const { locale, locales, pathname, query, asPath } = router;

  const handleLanguageChange = (event: SelectChangeEvent<string>) => {
    const newLocale = event.target.value;
    
    // Change locale while preserving the current path and query parameters
    router.push({ pathname, query }, asPath, { locale: newLocale });
  };

  const currentLanguage = SUPPORTED_LANGUAGES.find(lang => lang.code === locale);

  if (variant === 'compact') {
    return (
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <Select
          value={locale || 'en'}
          onChange={handleLanguageChange}
          displayEmpty
          startAdornment={<LanguageIcon sx={{ mr: 1, fontSize: 20 }} />}
          sx={{
            '& .MuiSelect-select': {
              display: 'flex',
              alignItems: 'center',
            },
          }}
        >
          {SUPPORTED_LANGUAGES.map((language) => (
            <MenuItem key={language.code} value={language.code}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2">
                  {language.nativeName}
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  return (
    <FormControl fullWidth>
      <InputLabel id="language-selector-label">
        {t('settings.language')}
      </InputLabel>
      <Select
        labelId="language-selector-label"
        value={locale || 'en'}
        label={t('settings.language')}
        onChange={handleLanguageChange}
        startAdornment={<LanguageIcon sx={{ mr: 1 }} />}
      >
        {SUPPORTED_LANGUAGES.map((language) => (
          <MenuItem key={language.code} value={language.code}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <Typography variant="body1">
                {language.nativeName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {language.name}
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};