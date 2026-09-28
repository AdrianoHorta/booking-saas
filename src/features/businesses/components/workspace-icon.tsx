const paths: Record<string, string> = {
  reservations: 'M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM3 9h18M8 2v4M16 2v4M8 13h2M14 13h2M8 17h2',
  services: 'M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1',
  employees: 'M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM5 21v-2a7 7 0 0 1 14 0v2M19 4a3 3 0 0 1 0 6M22 20v-2a6 6 0 0 0-3-5',
  availability: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18ZM12 7v5l3 2',
  insights: 'M4 3v17h17M8 16v-5M13 16V6M18 16V9',
  settings: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',
}

export function WorkspaceIcon({ name }: { name: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-5"><path d={paths[name]} /></svg>
}
