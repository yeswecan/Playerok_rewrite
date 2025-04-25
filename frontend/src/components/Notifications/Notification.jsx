import React from 'react';
import PropTypes from 'prop-types';

const Notification = ({ topic, payload, count, status, onDismissAnimationEnd }) => {
  const displayPayload = payload.split('\n').length > 10
    ? payload.split('\n').slice(0, 10).join('\n') + '\n...'
    : payload;

  const animationClass = status === 'dismissing' ? 'animate-fadeOutSlideUp' : 'animate-fadeInSlideUp';

  const handleAnimationEnd = (e) => {
    // Make sure we only trigger on the dismiss animation completing on the main div
    if (e.animationName === 'fadeOutSlideUp' && e.target === e.currentTarget && status === 'dismissing') {
      onDismissAnimationEnd();
    }
  };

  return (
    <div
      className={`relative mb-2 w-80 max-w-sm rounded-md border border-gray-300 bg-white p-4 shadow-lg ${animationClass}`}
      onAnimationEnd={handleAnimationEnd}
    >
      {count > 1 && (
        <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
          {count}
        </span>
      )}
      <p className="text-sm font-medium text-gray-800">
        New message. Topic: <strong className="font-bold">{topic}</strong>
      </p>
      <pre className="mt-1 overflow-hidden whitespace-pre-wrap break-words text-xs text-gray-600">
        {displayPayload}
      </pre>
    </div>
  );
};

Notification.propTypes = {
  topic: PropTypes.string.isRequired,
  payload: PropTypes.string.isRequired,
  count: PropTypes.number.isRequired,
  status: PropTypes.oneOf(['visible', 'dismissing']).isRequired,
  onDismissAnimationEnd: PropTypes.func.isRequired,
};

export default Notification; 