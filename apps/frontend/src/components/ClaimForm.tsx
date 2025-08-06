'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';

// Temporary types - will be replaced with proper shared types once dependencies are resolved
interface ClaimRequest {
  username: string;
  password: string;
  wa_number_e164: string;
  template: 'nodejs' | 'python';
}

interface ClaimFormProps {
  onSubmit: (data: ClaimRequest) => void;
  isSubmitting: boolean;
}

export function ClaimForm({ onSubmit, isSubmitting }: ClaimFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch
  } = useForm<ClaimRequest>({
    mode: 'onChange',
    defaultValues: {
      template: 'nodejs'
    }
  });

  const template = watch('template');

  const onFormSubmit = (data: ClaimRequest) => {
    // Ensure phone number starts with +
    const formattedData = {
      ...data,
      wa_number_e164: data.wa_number_e164.startsWith('+') 
        ? data.wa_number_e164 
        : `+${data.wa_number_e164}`
    };
    onSubmit(formattedData);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md"
    >
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🚀 Pterodactyl Auto-Claim
        </h1>
        <p className="text-gray-600">
          Create your free server instantly
        </p>
      </div>

      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
        {/* Username Field */}
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
            Username
          </label>
          <input
            {...register('username', {
              required: 'Username is required',
              minLength: { value: 3, message: 'Username must be at least 3 characters' },
              maxLength: { value: 32, message: 'Username must be less than 32 characters' },
              pattern: {
                value: /^[a-zA-Z0-9_-]+$/,
                message: 'Username can only contain letters, numbers, underscores, and hyphens'
              }
            })}
            type="text"
            id="username"
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
              errors.username ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter your username"
            disabled={isSubmitting}
          />
          {errors.username && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-500 text-sm mt-1"
            >
              {errors.username.message}
            </motion.p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
            Password
          </label>
          <div className="relative">
            <input
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Password must be at least 8 characters' },
                maxLength: { value: 128, message: 'Password must be less than 128 characters' }
              })}
              type={showPassword ? 'text' : 'password'}
              id="password"
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-12 ${
                errors.password ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter your password"
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              disabled={isSubmitting}
            >
              {showPassword ? '👁️' : '🙈'}
            </button>
          </div>
          {errors.password && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-500 text-sm mt-1"
            >
              {errors.password.message}
            </motion.p>
          )}
        </div>

        {/* WhatsApp Number Field */}
        <div>
          <label htmlFor="wa_number_e164" className="block text-sm font-medium text-gray-700 mb-2">
            WhatsApp Number
          </label>
          <input
            {...register('wa_number_e164', {
              required: 'WhatsApp number is required',
              pattern: {
                value: /^\+?[1-9]\d{1,14}$/,
                message: 'Please enter a valid phone number (e.g., +1234567890)'
              }
            })}
            type="tel"
            id="wa_number_e164"
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
              errors.wa_number_e164 ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="+1234567890"
            disabled={isSubmitting}
          />
          {errors.wa_number_e164 && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-500 text-sm mt-1"
            >
              {errors.wa_number_e164.message}
            </motion.p>
          )}
          <p className="text-gray-500 text-xs mt-1">
            📱 Must be a member of the WhatsApp group
          </p>
        </div>

        {/* Template Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Server Template
          </label>
          <div className="grid grid-cols-2 gap-3">
            <motion.label
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`cursor-pointer border rounded-lg p-4 text-center transition-all ${
                template === 'nodejs'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input
                {...register('template')}
                type="radio"
                value="nodejs"
                className="sr-only"
                disabled={isSubmitting}
              />
              <div className="text-2xl mb-2">⚡</div>
              <div className="font-medium">Node.js</div>
              <div className="text-xs text-gray-500">JavaScript Runtime</div>
            </motion.label>

            <motion.label
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`cursor-pointer border rounded-lg p-4 text-center transition-all ${
                template === 'python'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input
                {...register('template')}
                type="radio"
                value="python"
                className="sr-only"
                disabled={isSubmitting}
              />
              <div className="text-2xl mb-2">🐍</div>
              <div className="font-medium">Python</div>
              <div className="text-xs text-gray-500">Python Runtime</div>
            </motion.label>
          </div>
        </div>

        {/* Submit Button */}
        <motion.button
          whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
          whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
          type="submit"
          disabled={!isValid || isSubmitting}
          className={`w-full py-3 px-6 rounded-lg font-medium transition-all ${
            isValid && !isSubmitting
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          <AnimatePresence mode="wait">
            {isSubmitting ? (
              <motion.div
                key="submitting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center"
              >
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Creating Server...
              </motion.div>
            ) : (
              <motion.span
                key="submit"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                🚀 Create Server
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </form>

      {/* Disclaimer */}
      <div className="mt-6 text-center text-xs text-gray-500">
        <p>⚠️ By submitting, you agree that:</p>
        <ul className="mt-2 space-y-1">
          <li>• Your WhatsApp must be in the designated group</li>
          <li>• Server will be deleted if you leave the group</li>
          <li>• Username must be unique across the panel</li>
        </ul>
      </div>
    </motion.div>
  );
}
