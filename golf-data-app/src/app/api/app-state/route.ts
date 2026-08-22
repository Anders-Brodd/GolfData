import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const stateFilePath = path.join(process.cwd(), 'app_state.json');

// Default initial state
const DEFAULT_STATE = {
  tabs: [{ name: 'Tab 1', lineups: [] }],
  activeTabIdx: 0,
  playerOverrides: {},
  weights: null, // Will use client defaults if null
  safetyWeight: 0,
  fileConfigs: [
    { rounds: 16, weight: 33 },
    { rounds: 32, weight: 33 },
    { rounds: 64, weight: 34 }
  ],
  optimizerSettings: {
    numLineups: 20,
    maxExposure: 50,
    minUniques: 2,
    minSalary: 49000,
    maxSalary: 50000
  },
  lastUpdated: Date.now()
};

async function getState() {
  try {
    const data = await fs.readFile(stateFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      await fs.writeFile(stateFilePath, JSON.stringify(DEFAULT_STATE, null, 2));
      return DEFAULT_STATE;
    }
    throw err;
  }
}

export async function GET() {
  try {
    const state = await getState();
    return NextResponse.json({ success: true, state });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const updates = await req.json();
    const currentState = await getState();
    
    // Merge updates
    const newState = {
      ...currentState,
      ...updates,
      lastUpdated: Date.now()
    };
    
    await fs.writeFile(stateFilePath, JSON.stringify(newState, null, 2));
    return NextResponse.json({ success: true, state: newState });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
