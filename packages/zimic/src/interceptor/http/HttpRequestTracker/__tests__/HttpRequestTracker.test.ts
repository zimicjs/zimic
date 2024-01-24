import { describe, expect, it, vi } from 'vitest';

import { HttpInterceptorMethodSchema } from '../../HttpInterceptor/types/schema';
import NoResponseDefinitionError from '../errors/NoResponseDefinitionError';
import HttpRequestTracker from '../HttpRequestTracker';
import InternalHttpRequestTracker from '../InternalHttpRequestTracker';
import { HttpInterceptorRequest, HttpRequestTrackerResponseDeclaration } from '../types/requests';

describe('HttpRequestTracker', () => {
  const defaultBaseURL = 'http://localhost:3000';

  it('should instantiate correctly', () => {
    const tracker = new InternalHttpRequestTracker();
    expect(tracker).toBeInstanceOf(HttpRequestTracker);
  });

  it('should not match any request if contains no declared response', () => {
    const tracker = new InternalHttpRequestTracker();

    const request = new Request(defaultBaseURL);
    expect(tracker.matchesRequest(request)).toBe(false);
  });

  it('should match any request if contains declared response', () => {
    const tracker = new InternalHttpRequestTracker().respond({
      status: 200,
      body: {},
    });

    const request = new Request(defaultBaseURL);
    expect(tracker.matchesRequest(request)).toBe(true);
  });

  it('should not match any request if bypassed', () => {
    const tracker = new InternalHttpRequestTracker();

    const request = new Request(defaultBaseURL);
    expect(tracker.matchesRequest(request)).toBe(false);

    tracker.bypass();
    expect(tracker.matchesRequest(request)).toBe(false);

    tracker.respond({
      status: 200,
      body: {},
    });
    expect(tracker.matchesRequest(request)).toBe(true);

    tracker.bypass();
    expect(tracker.matchesRequest(request)).toBe(false);
  });

  it('should create response with declared status and body', async () => {
    const responseStatus = 201;
    const responseBody = { success: true };

    const tracker = new InternalHttpRequestTracker().respond({
      status: responseStatus,
      body: responseBody,
    });

    const request = new Request(defaultBaseURL);
    const response = await tracker.applyResponseDeclaration(request);

    expect(response.status).toBe(responseStatus);
    expect(response.body).toEqual(responseBody);
  });

  it('should create response with declared status and body factory', async () => {
    const responseStatus = 201;
    const responseBody = { success: true };

    const responseFactory = vi.fn<
      [HttpInterceptorRequest<HttpInterceptorMethodSchema>],
      HttpRequestTrackerResponseDeclaration<HttpInterceptorMethodSchema, number>
    >(() => ({
      status: responseStatus,
      body: responseBody,
    }));

    const tracker = new InternalHttpRequestTracker();
    tracker.respond(responseFactory);

    const request = new Request(defaultBaseURL);
    const response = await tracker.applyResponseDeclaration(request);

    expect(response.status).toBe(responseStatus);
    expect(response.body).toEqual(responseBody);

    expect(responseFactory).toHaveBeenCalledTimes(1);
    expect(responseFactory).toHaveBeenCalledWith(request);
  });

  it('should throw an error if trying to create a response without a declared response', async () => {
    const tracker = new InternalHttpRequestTracker();

    const request = new Request(defaultBaseURL);

    await expect(async () => {
      await tracker.applyResponseDeclaration(request);
    }).rejects.toThrowError(NoResponseDefinitionError);
  });

  it('should keep track of the intercepted requests and responses', async () => {
    const tracker = new InternalHttpRequestTracker().respond({
      status: 200,
      body: {},
    });

    const firstRequest = new Request(defaultBaseURL);

    const firstResponseDeclaration = await tracker.applyResponseDeclaration(firstRequest);
    const firstResponse = Response.json(firstResponseDeclaration.body, {
      status: firstResponseDeclaration.status,
    }) as Response & { status: 200 };

    tracker.registerInterceptedRequest(firstRequest, firstResponse);

    const interceptedRequests = tracker.requests();
    expect(interceptedRequests).toHaveLength(1);

    expect(interceptedRequests[0]).toEqual(firstRequest);
    expect(interceptedRequests[0].response).toEqual(firstResponse);

    const secondRequest = new Request(`${defaultBaseURL}/path`);
    const secondResponseDeclaration = await tracker.applyResponseDeclaration(secondRequest);

    const secondResponse = Response.json(secondResponseDeclaration.body, {
      status: secondResponseDeclaration.status,
    }) as Response & { status: 200 };

    tracker.registerInterceptedRequest(secondRequest, secondResponse);

    expect(interceptedRequests).toHaveLength(2);

    expect(interceptedRequests[0]).toEqual(firstRequest);
    expect(interceptedRequests[0].response).toEqual(firstResponse);

    expect(interceptedRequests[1]).toEqual(secondRequest);
    expect(interceptedRequests[1].response).toEqual(secondResponse);
  });
});
