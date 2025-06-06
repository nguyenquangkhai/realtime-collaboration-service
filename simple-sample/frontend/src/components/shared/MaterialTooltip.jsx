import React, { useState } from 'react';
import './MaterialTooltip.css';

const MaterialTooltip = ({ 
  children, 
  content, 
  position = 'top',
  trigger = 'hover', // 'hover', 'click', 'focus'
  maxWidth = '300px'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isClicked, setIsClicked] = useState(false);

  const handleMouseEnter = () => {
    if (trigger === 'hover') setIsVisible(true);
  };

  const handleMouseLeave = () => {
    if (trigger === 'hover') setIsVisible(false);
  };

  const handleClick = () => {
    if (trigger === 'click') {
      setIsClicked(!isClicked);
      setIsVisible(!isVisible);
    }
  };

  const handleFocus = () => {
    if (trigger === 'focus') setIsVisible(true);
  };

  const handleBlur = () => {
    if (trigger === 'focus') setIsVisible(false);
  };

  return (
    <div className="material-tooltip-container">
      <div
        className="material-tooltip-trigger"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onFocus={handleFocus}
        onBlur={handleBlur}
        tabIndex={trigger === 'focus' ? 0 : undefined}
      >
        {children}
      </div>
      
      {isVisible && (
        <div 
          className={`material-tooltip material-tooltip--${position} ${isClicked ? 'material-tooltip--clicked' : ''}`}
          style={{ maxWidth }}
          role="tooltip"
        >
          <div className="material-tooltip__content">
            {content}
          </div>
          <div className="material-tooltip__arrow"></div>
        </div>
      )}
    </div>
  );
};

export default MaterialTooltip; 