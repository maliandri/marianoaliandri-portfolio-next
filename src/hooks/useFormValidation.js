'use client';

// src/hooks/useFormValidation.js
// 📝 Hook personalizado para React Hook Form con Zod
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

/**
 * Hook personalizado para formularios con validación Zod
 * Combina React Hook Form + Zod + manejo de errores
 *
 * @param {Object} options - Opciones de configuración
 * @param {z.ZodSchema} options.schema - Schema de Zod para validación
 * @param {Object} options.defaultValues - Valores por defecto del formulario
 * @param {Function} options.onSubmit - Función a ejecutar al enviar (recibe datos validados)
 * @param {Function} options.onError - Función opcional para manejar errores
 * @returns {Object} Métodos y estado de React Hook Form
 *
 * @example
 * const { register, handleSubmit, formState: { errors, isSubmitting } } = useFormValidation({
 *   schema: contactFormSchema,
 *   defaultValues: { name: '', email: '', message: '' },
 *   onSubmit: async (data) => {
 *     await sendEmail(data);
 *   }
 * });
 */
export function useFormValidation({ schema, defaultValues = {}, onSubmit, onError }) {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onBlur', // Validar al perder el foco
  });

  /**
   * Wrapper del submit que maneja errores automáticamente
   */
  const handleFormSubmit = form.handleSubmit(
    async (data) => {
      try {
        await onSubmit(data);
      } catch (error) {
        console.error('Form submission error:', error);

        if (onError) {
          onError(error);
        }
      }
    },
    (errors) => {
      console.warn('Form validation errors:', errors);
      if (onError) {
        onError(new Error('Errores de validación'));
      }
    }
  );

  return {
    ...form,
    handleSubmit: handleFormSubmit,
  };
}

/**
 * Helper para obtener mensaje de error de un campo
 * @param {Object} errors - Objeto de errores de React Hook Form
 * @param {string} fieldName - Nombre del campo
 * @returns {string|null} Mensaje de error o null
 *
 * @example
 * <input {...register('email')} />
 * {getErrorMessage(errors, 'email') && (
 *   <span className="text-red-500">{getErrorMessage(errors, 'email')}</span>
 * )}
 */
export function getErrorMessage(errors, fieldName) {
  const error = errors[fieldName];
  return error?.message || null;
}

/**
 * Helper para aplicar clases CSS condicionales basadas en errores
 * @param {Object} errors - Objeto de errores
 * @param {string} fieldName - Nombre del campo
 * @param {string} baseClass - Clase base
 * @param {string} errorClass - Clase para error
 * @returns {string} Clases CSS combinadas
 *
 * @example
 * <input
 *   {...register('email')}
 *   className={getFieldClass(errors, 'email', 'input', 'input-error')}
 * />
 */
export function getFieldClass(errors, fieldName, baseClass, errorClass) {
  return errors[fieldName] ? `${baseClass} ${errorClass}` : baseClass;
}

/**
 * Hook para formularios multi-paso
 * @param {number} totalSteps - Número total de pasos
 * @returns {Object} Control de pasos
 *
 * @example
 * const { currentStep, nextStep, prevStep, goToStep, isFirstStep, isLastStep } = useMultiStepForm(3);
 */
export function useMultiStepForm(totalSteps) {
  const [currentStep, setCurrentStep] = React.useState(1);

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const goToStep = (step) => {
    if (step >= 1 && step <= totalSteps) {
      setCurrentStep(step);
    }
  };

  return {
    currentStep,
    nextStep,
    prevStep,
    goToStep,
    isFirstStep: currentStep === 1,
    isLastStep: currentStep === totalSteps,
    progress: (currentStep / totalSteps) * 100,
  };
}
