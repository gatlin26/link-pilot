import { NextResponse } from 'next/server';

export async function POST() {
	return NextResponse.json({
		success: true,
		data: {
			version: '1.0.0',
			timestamp: new Date().toISOString(),
		},
	});
}
