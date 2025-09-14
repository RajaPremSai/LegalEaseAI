import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Chip
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Save, Preview, Download, Close } from '@mui/icons-material';
import { DocumentTemplate, CustomizationOption } from '@legal-ai/shared';

interface TemplateCustomizerProps {
  template: DocumentTemplate;
  open: boolean;
  onClose: () => void;
  onSave?: (customizedContent: string) => void;
}

interface CustomizationValues {
  [fieldName: string]: any;
}

const TemplateCustomizer: React.FC<TemplateCustomizerProps> = ({
  template,
  open,
  onClose,
  onSave
}) => {
  const [values, setValues] = useState<CustomizationValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (template) {
      // Initialize values with defaults
      const initialValues: CustomizationValues = {};
      template.customizationOptions.forEach(option => {
        if (option.defaultValue !== undefined) {
          initialValues[option.fieldName] = option.defaultValue;
        }
      });
      setValues(initialValues);
      setErrors({});
    }
  }, [template]);

  const validateField = (option: CustomizationOption, value: any): string | null => {
    if (option.required && (value === undefined || value === null || value === '')) {
      return `${option.label} is required`;
    }

    if (value !== undefined && value !== null && value !== '' && option.validation) {
      const validation = option.validation;

      switch (option.fieldType) {
        case 'text':
          if (typeof value !== 'string') return `${option.label} must be text`;
          if (validation.minLength && value.length < validation.minLength) {
            return `${option.label} must be at least ${validation.minLength} characters`;
          }
          if (validation.maxLength && value.length > validation.maxLength) {
            return `${option.label} must be at most ${validation.maxLength} characters`;
          }
          if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
            return `${option.label} format is invalid`;
          }
          break;

        case 'number':
          const numValue = Number(value);
          if (isNaN(numValue)) return `${option.label} must be a number`;
          if (validation.min !== undefined && numValue < validation.min) {
            return `${option.label} must be at least ${validation.min}`;
          }
          if (validation.max !== undefined && numValue > validation.max) {
            return `${option.label} must be at most ${validation.max}`;
          }
          break;

        case 'select':
          if (option.options && !option.options.includes(value)) {
            return `${option.label} must be one of: ${option.options.join(', ')}`;
          }
          break;

        case 'multiselect':
          if (!Array.isArray(value)) return `${option.label} must be a list`;
          for (const item of value) {
            if (option.options && !option.options.includes(item)) {
              return `${option.label} contains invalid option: ${item}`;
            }
          }
          break;
      }
    }

    return null;
  };

  const validateAllFields = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    template.customizationOptions.forEach(option => {
      const error = validateField(option, values[option.fieldName]);
      if (error) {
        newErrors[option.fieldName] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleValueChange = (fieldName: string, value: any) => {
    setValues(prev => ({ ...prev, [fieldName]: value }));
    
    // Clear error for this field
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const handlePreview = async () => {
    if (!validateAllFields()) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/templates/${template.id}/customize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          customizations: values
        })
      });

      const data = await response.json();
      if (data.success) {
        setPreviewContent(data.data.customizedContent);
        setShowPreview(true);
      } else {
        setErrors({ general: data.error || 'Failed to generate preview' });
      }
    } catch (error) {
      setErrors({ general: 'Failed to generate preview' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (previewContent) {
      onSave?.(previewContent);
      onClose();
    }
  };

  const renderField = (option: CustomizationOption) => {
    const value = values[option.fieldName];
    const error = errors[option.fieldName];

    switch (option.fieldType) {
      case 'text':
        return (
          <TextField
            fullWidth
            label={option.label}
            value={value || ''}
            onChange={(e) => handleValueChange(option.fieldName, e.target.value)}
            error={!!error}
            helperText={error || option.description}
            required={option.required}
            multiline={option.validation?.maxLength && option.validation.maxLength > 100}
            rows={option.validation?.maxLength && option.validation.maxLength > 100 ? 3 : 1}
          />
        );

      case 'number':
        return (
          <TextField
            fullWidth
            type="number"
            label={option.label}
            value={value || ''}
            onChange={(e) => handleValueChange(option.fieldName, Number(e.target.value))}
            error={!!error}
            helperText={error || option.description}
            required={option.required}
            inputProps={{
              min: option.validation?.min,
              max: option.validation?.max
            }}
          />
        );

      case 'select':
        return (
          <FormControl fullWidth error={!!error}>
            <InputLabel required={option.required}>{option.label}</InputLabel>
            <Select
              value={value || ''}
              label={option.label}
              onChange={(e) => handleValueChange(option.fieldName, e.target.value)}
            >
              {option.options?.map((optionValue) => (
                <MenuItem key={optionValue} value={optionValue}>
                  {optionValue}
                </MenuItem>
              ))}
            </Select>
            {(error || option.description) && (
              <Typography variant="caption" color={error ? 'error' : 'text.secondary'} sx={{ mt: 0.5, ml: 1.5 }}>
                {error || option.description}
              </Typography>
            )}
          </FormControl>
        );

      case 'multiselect':
        return (
          <FormControl fullWidth error={!!error}>
            <InputLabel required={option.required}>{option.label}</InputLabel>
            <Select
              multiple
              value={value || []}
              label={option.label}
              onChange={(e) => handleValueChange(option.fieldName, e.target.value)}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map((val) => (
                    <Chip key={val} label={val} size="small" />
                  ))}
                </Box>
              )}
            >
              {option.options?.map((optionValue) => (
                <MenuItem key={optionValue} value={optionValue}>
                  {optionValue}
                </MenuItem>
              ))}
            </Select>
            {(error || option.description) && (
              <Typography variant="caption" color={error ? 'error' : 'text.secondary'} sx={{ mt: 0.5, ml: 1.5 }}>
                {error || option.description}
              </Typography>
            )}
          </FormControl>
        );

      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Checkbox
                checked={value || false}
                onChange={(e) => handleValueChange(option.fieldName, e.target.checked)}
              />
            }
            label={
              <Box>
                <Typography variant="body2">
                  {option.label} {option.required && '*'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {option.description}
                </Typography>
              </Box>
            }
          />
        );

      case 'date':
        return (
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label={option.label}
              value={value ? new Date(value) : null}
              onChange={(date) => handleValueChange(option.fieldName, date)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  error={!!error}
                  helperText={error || option.description}
                  required={option.required}
                />
              )}
            />
          </LocalizationProvider>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { height: '90vh' }
        }}
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h5">Customize Template: {template.name}</Typography>
            <Button onClick={onClose} startIcon={<Close />}>
              Close
            </Button>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          {errors.general && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors.general}
            </Alert>
          )}

          <Typography variant="body1" color="text.secondary" paragraph>
            Fill in the fields below to customize your template. Required fields are marked with an asterisk (*).
          </Typography>

          <Grid container spacing={3}>
            {template.customizationOptions.map((option) => (
              <Grid item xs={12} sm={6} key={option.id}>
                {renderField(option)}
              </Grid>
            ))}
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={handlePreview}
            startIcon={<Preview />}
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Preview'}
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            startIcon={<Save />}
            disabled={!previewContent}
          >
            Save Customized Template
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog
        open={showPreview}
        onClose={() => setShowPreview(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { height: '90vh' }
        }}
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Template Preview</Typography>
            <Button onClick={() => setShowPreview(false)} startIcon={<Close />}>
              Close
            </Button>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          <Paper sx={{ p: 3, height: '100%', overflow: 'auto' }}>
            <Typography
              component="pre"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {previewContent}
            </Typography>
          </Paper>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setShowPreview(false)}>
            Back to Edit
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            startIcon={<Download />}
          >
            Download Template
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TemplateCustomizer;