'use client';

// src/hooks/useLinkedIn.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const LINKEDIN_KEYS = {
  status: ['linkedin', 'status'],
  profile: ['linkedin', 'profile'],
  posts: ['linkedin', 'posts'],
  analytics: ['linkedin', 'analytics']
};

async function linkedinAuthAction(action) {
  const res = await fetch('/.netlify/functions/linkedin-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  });
  if (!res.ok) throw new Error('Error en LinkedIn auth');
  return res.json();
}

async function linkedinDataAction(action) {
  const res = await fetch('/.netlify/functions/linkedin-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('NOT_CONNECTED');
    throw new Error('Error en LinkedIn data');
  }
  return res.json();
}

// Estado de conexión de LinkedIn
export function useLinkedInStatus() {
  return useQuery({
    queryKey: LINKEDIN_KEYS.status,
    queryFn: () => linkedinAuthAction('status'),
    staleTime: 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: true
  });
}

// Perfil de LinkedIn
export function useLinkedInProfile(enabled = true) {
  return useQuery({
    queryKey: LINKEDIN_KEYS.profile,
    queryFn: async () => {
      const result = await linkedinDataAction('profile');
      return result.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1
  });
}

// Posts de LinkedIn
export function useLinkedInPosts(enabled = true) {
  return useQuery({
    queryKey: LINKEDIN_KEYS.posts,
    queryFn: async () => {
      const result = await linkedinDataAction('posts');
      return result.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1
  });
}

// Analytics de LinkedIn
export function useLinkedInAnalytics(enabled = true) {
  return useQuery({
    queryKey: LINKEDIN_KEYS.analytics,
    queryFn: async () => {
      const result = await linkedinDataAction('analytics');
      return result.data;
    },
    enabled,
    staleTime: 10 * 60 * 1000,
    retry: 1
  });
}

// Conectar LinkedIn (iniciar OAuth)
export function useLinkedInConnect() {
  return useMutation({
    mutationFn: async () => {
      const result = await linkedinAuthAction('getAuthUrl');
      // Abrir ventana de OAuth
      window.location.href = result.authUrl;
      return result;
    }
  });
}

// Desconectar LinkedIn
export function useLinkedInDisconnect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => linkedinAuthAction('disconnect'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedin'] });
    }
  });
}
