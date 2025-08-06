'use client';

import { motion } from 'framer-motion';

// Temporary types
interface ClaimStatusResponse {
  status: string;
  message: string;
  server_details?: {
    panel_url?: string;
    username?: string;
    allocation_ip?: string;
    allocation_port?: number;
  };
}

interface StatusDisplayProps {
  claimId: string;
  status?: ClaimStatusResponse;
  isPolling: boolean;
  pollAttempts: number;
  error?: string;
  onReset: () => void;
}

export function StatusDisplay({ 
  claimId, 
  status, 
  isPolling, 
  pollAttempts,
  error,
  onReset 
}: StatusDisplayProps) {

  const getStatusIcon = () => {
    if (error) return '❌';
    if (status?.status === 'active') return '✅';
    if (status?.status === 'failed') return '💥';
    if (isPolling) return '🔄';
    return '⏳';
  };

  const getStatusMessage = () => {
    if (error) return error;
    if (status?.status === 'active') return 'Server is ready! 🎉';
    if (status?.status === 'failed') return status.message || 'Server creation failed';
    if (isPolling) return `Creating server... (${pollAttempts}/60)`;
    return 'Initializing...';
  };

  const getStatusColor = () => {
    if (error || status?.status === 'failed') return 'text-red-600';
    if (status?.status === 'active') return 'text-green-600';
    return 'text-blue-600';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md"
    >
      <div className="text-center">
        {/* Status Icon */}
        <motion.div
          animate={isPolling ? { rotate: 360 } : {}}
          transition={isPolling ? { 
            duration: 2, 
            repeat: Infinity, 
            ease: "linear" 
          } : {}}
          className="text-6xl mb-4"
        >
          {getStatusIcon()}
        </motion.div>

        {/* Claim ID */}
        <div className="bg-gray-100 rounded-lg p-3 mb-6">
          <p className="text-sm text-gray-600 mb-1">Claim ID</p>
          <p className="font-mono text-lg font-bold text-gray-900 break-all">
            {claimId}
          </p>
        </div>

        {/* Status Message */}
        <motion.h2
          key={getStatusMessage()}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-2xl font-bold mb-4 ${getStatusColor()}`}
        >
          {getStatusMessage()}
        </motion.h2>

        {/* Progress Bar for Creating Status */}
        {isPolling && (
          <div className="mb-6">
            <div className="bg-gray-200 rounded-full h-2 mb-2">
              <motion.div
                className="bg-blue-600 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(pollAttempts / 60) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="text-sm text-gray-600">
              {pollAttempts}/60 checks completed
            </p>
          </div>
        )}

        {/* Server Details (Success State) */}
        {status?.status === 'active' && status.server_details && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-left"
          >
            <h3 className="font-bold text-green-800 mb-3">🎮 Server Details</h3>
            <div className="space-y-2 text-sm">
              {status.server_details.panel_url && (
                <div>
                  <span className="text-green-700 font-medium">Panel URL: </span>
                  <a 
                    href={status.server_details.panel_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all"
                  >
                    {status.server_details.panel_url}
                  </a>
                </div>
              )}
              {status.server_details.username && (
                <div>
                  <span className="text-green-700 font-medium">Username: </span>
                  <span className="font-mono">{status.server_details.username}</span>
                </div>
              )}
              {status.server_details.allocation_ip && status.server_details.allocation_port && (
                <div>
                  <span className="text-green-700 font-medium">Connection: </span>
                  <span className="font-mono">
                    {status.server_details.allocation_ip}:{status.server_details.allocation_port}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Error Details */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left"
          >
            <h3 className="font-bold text-red-800 mb-2">💥 Error Details</h3>
            <p className="text-sm text-red-700">{error}</p>
          </motion.div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Reset Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onReset}
            className="w-full py-3 px-6 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            🔄 Create Another Server
          </motion.button>

          {/* Manual Check Button (if not polling) */}
          {!isPolling && claimId && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => window.location.reload()}
              className="w-full py-2 px-4 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
            >
              🔍 Check Status Manually
            </motion.button>
          )}
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-xs text-gray-500">
          <p>💡 <strong>Next Steps:</strong></p>
          <ul className="mt-2 space-y-1 text-left">
            <li>• Log into the panel with your credentials</li>
            <li>• Start your server from the control panel</li>
            <li>• Upload your files via SFTP or file manager</li>
            <li>• Stay in the WhatsApp group to keep your server</li>
          </ul>
        </div>
      </div>
    </motion.div>
  );
}
