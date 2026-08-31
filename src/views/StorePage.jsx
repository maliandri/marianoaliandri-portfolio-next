'use client';
import React from 'react';
import Store from '../components/Store';

export default function StorePage() {
  return <Store isOpen={true} onClose={() => window.history.back()} asPage={true} />;
}
