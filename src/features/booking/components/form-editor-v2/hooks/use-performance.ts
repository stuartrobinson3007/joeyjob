import React, { useEffect, useRef, useCallback } from 'react';
import { eventBus } from '../core/events/event-bus';

interface PerformanceMetrics {
  renderTime: number;
  updateTime: number;
  validationTime: number;
  saveTime: number;
  memoryUsage?: number;
}

interface PerformanceThresholds {
  renderTime: number; // ms
  updateTime: number; // ms
  validationTime: number; // ms
  saveTime: number; // ms
  memoryUsage?: number; // MB
}

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  renderTime: 100, // 100ms
  updateTime: 50, // 50ms
  validationTime: 200, // 200ms
  saveTime: 1000, // 1s
  memoryUsage: 50 // 50MB
};

export function usePerformance(thresholds: Partial<PerformanceThresholds> = {}) {
  const metricsRef = useRef<PerformanceMetrics>({
    renderTime: 0,
    updateTime: 0,
    validationTime: 0,
    saveTime: 0
  });
  
  const finalThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const timersRef = useRef<Map<string, number>>(new Map());

  // Start performance timer
  const startTimer = useCallback((label: string) => {
    timersRef.current.set(label, performance.now());
  }, []);

  // End performance timer and record metric
  const endTimer = useCallback((label: string) => {
    const startTime = timersRef.current.get(label);
    if (startTime) {
      const duration = performance.now() - startTime;
      timersRef.current.delete(label);
      
      // Update metrics
      switch (label) {
        case 'render':
          metricsRef.current.renderTime = duration;
          break;
        case 'update':
          metricsRef.current.updateTime = duration;
          break;
        case 'validation':
          metricsRef.current.validationTime = duration;
          break;
        case 'save':
          metricsRef.current.saveTime = duration;
          break;
      }
      
      // Check thresholds and warn if exceeded
      const threshold = finalThresholds[label as keyof PerformanceThresholds];
      if (threshold && duration > threshold) {
        eventBus.emit('error.occurred', {
          source: 'performance',
          error: new Error(`Performance threshold exceeded: ${label}`),
          context: { duration, threshold, label }
        });
      }
      
      return duration;
    }
    return 0;
  }, [finalThresholds]);

  // Get memory usage (if supported)
  const getMemoryUsage = useCallback(() => {
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      const usedMB = memory.usedJSHeapSize / 1024 / 1024;
      
      metricsRef.current.memoryUsage = usedMB;
      
      return {
        used: usedMB,
        total: memory.totalJSHeapSize / 1024 / 1024,
        limit: memory.jsHeapSizeLimit / 1024 / 1024
      };
    }
    return null;
  }, []);

  // Measure component render time
  const measureRender = useCallback((callback: () => void) => {
    startTimer('render');
    callback();
    return endTimer('render');
  }, [startTimer, endTimer]);

  // Monitor long tasks (if supported)
  useEffect(() => {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.duration > 50) { // Long task threshold
            eventBus.emit('error.occurred', {
              source: 'performance',
              error: new Error('Long task detected'),
              context: { duration: entry.duration, type: 'longtask' }
            });
          }
        });
      });
      
      try {
        observer.observe({ entryTypes: ['longtask'] });
        
        return () => {
          observer.disconnect();
        };
      } catch (error) {
        // longtask observer might not be supported
        console.warn('Long task monitoring not supported');
      }
    }
  }, []);

  // Periodic memory monitoring
  useEffect(() => {
    if (finalThresholds.memoryUsage) {
      const interval = setInterval(() => {
        getMemoryUsage();
      }, 10000); // Check every 10 seconds
      
      return () => clearInterval(interval);
    }
  }, [finalThresholds.memoryUsage, getMemoryUsage]);

  // Performance logging utility
  const logMetrics = useCallback(() => {
    const memory = getMemoryUsage();
    if (process.env.NODE_ENV === 'development') {
      console.group('🚀 Performance Metrics');
      console.log('Render time:', `${metricsRef.current.renderTime.toFixed(2)}ms`);
      console.log('Update time:', `${metricsRef.current.updateTime.toFixed(2)}ms`);
      console.log('Validation time:', `${metricsRef.current.validationTime.toFixed(2)}ms`);
      console.log('Save time:', `${metricsRef.current.saveTime.toFixed(2)}ms`);
      
      if (memory) {
        console.log('Memory usage:', `${memory.used.toFixed(2)}MB / ${memory.limit.toFixed(2)}MB`);
      }
      console.groupEnd();
    }
  }, [getMemoryUsage]);

  return {
    startTimer,
    endTimer,
    measureRender,
    getMemoryUsage,
    logMetrics,
    metrics: metricsRef.current
  };
}

// Higher-order component for measuring render performance
export function withPerformanceMetrics<T extends {}>(WrappedComponent: React.ComponentType<T>) {
  return function PerformanceWrapper(props: T) {
    return React.createElement(WrappedComponent, props);
  };
}

// Hook for measuring async operations
export function useAsyncPerformance() {
  const { startTimer, endTimer } = usePerformance();
  
  const measureAsync = useCallback(async <T>(
    label: string,
    asyncFn: () => Promise<T>
  ): Promise<T> => {
    startTimer(label);
    try {
      const result = await asyncFn();
      return result;
    } finally {
      endTimer(label);
    }
  }, [startTimer, endTimer]);
  
  return { measureAsync };
}