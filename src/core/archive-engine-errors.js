'use strict';

class CancelledError extends Error {
  constructor(message = '任务已取消。') {
    super(message);
    this.name = 'CancelledError';
    this.code = 'TASK_CANCELLED';
  }
}

module.exports = { CancelledError };
