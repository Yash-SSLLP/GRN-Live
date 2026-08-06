import React, { useState } from 'react';

// Password box with a show/hide eye. The app carries no icon library, so the
// two states are inline SVGs — they inherit currentColor and render the same on
// every platform (emoji glyphs do not).
const EyeOpen = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1.5 12S5 5.5 12 5.5 22.5 12 22.5 12 19 18.5 12 18.5 1.5 12 1.5 12z" />
    <circle cx="12" cy="12" r="3.2" />
  </svg>
);
const EyeOff = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9.9 5.7A9.6 9.6 0 0 1 12 5.5c7 0 10.5 6.5 10.5 6.5a17.7 17.7 0 0 1-3.4 4.3M6.2 7.7A17.6 17.6 0 0 0 1.5 12S5 18.5 12 18.5c1.9 0 3.5-.5 4.9-1.2" />
    <path d="M9.9 9.9a3.2 3.2 0 0 0 4.3 4.3" />
    <path d="M3 3l18 18" />
  </svg>
);

export default function PasswordInput({ value, onChange, placeholder, autoComplete, onKeyDown, autoFocus, disabled, className }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pwwrap">
      <input
        className={'input' + (className ? ' ' + className : '')}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        disabled={disabled}
      />
      {/* tabIndex -1 keeps the toggle out of the tab order, so Tab still walks
          straight from the password field to the submit button. */}
      <button type="button" className="pweye" tabIndex={-1} disabled={disabled}
        aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
        title={show ? 'Hide password' : 'Show password'}
        onClick={() => setShow((s) => !s)}>
        {show ? <EyeOff /> : <EyeOpen />}
      </button>
    </div>
  );
}
