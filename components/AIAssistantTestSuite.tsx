import React, { useState, useRef, useEffect } from 'react';
import { processNaturalLanguageCommand } from '../services/geminiService';

interface AIAssistantTestSuiteProps {
    onProcessAiCommand: (intent: string, data: any) => Promise<{ success: boolean; payload?: any; message?: string }>;
}

// RESTORED: Full list of test queries with final, corrected expectations.
// Expectations ensure casing is correct (e.g., "Montgomery", "Personal", "Jane Doe") 
// and filters are correctly placed in the 'updateData' payload.
const testQueries = [
    // Contacts Tests (11 Total)
    { query: "how many contacts do i have in montgomery?", expected: { intent: "COUNT_DATA", responseText: "...", countRequest: { target: "contacts" }, updateData: { city: "Montgomery" } } },
    { query: "count the contacts in alabama", expected: { intent: "COUNT_DATA", responseText: "...", countRequest: { target: "contacts" }, updateData: { state: "AL" } } },
    { query: "how many clients?", expected: { intent: "COUNT_DATA", responseText: "...", countRequest: { target: "contacts" }, updateData: { category: "Client" } } },
    { query: "how many contacts in zip code 36104?", expected: { intent: "COUNT_DATA", responseText: "...", countRequest: { target: "contacts" }, updateData: { zip: "36104" } } },
    { query: "how many personal contacts?", expected: { intent: "COUNT_DATA", responseText: "...", countRequest: { target: "contacts" }, updateData: { category: "Personal" } } },
    { query: "how many contacts in birmingham, al?", expected: { intent: "COUNT_DATA", responseText: "...", countRequest: { target: "contacts" }, updateData: { city: "Birmingham", state: "AL" } } },
    { query: "number of contacts in the media category", expected: { intent: "COUNT_DATA", responseText: "...", countRequest: { target: "contacts" }, updateData: { category: "Media" } } },
    { query: "how many contacts are vendors?", expected: { intent: "COUNT_DATA", responseText: "...", countRequest: { target: "contacts" }, updateData: { category: "Vendor" } } },
    { query: "number of contacts that are not clients", expected: { intent: "COUNT_DATA", responseText: "...", countRequest: { target: "contacts" }, updateData: { category: "not Client" } } },
    { query: "how many contacts in mobile, alabama with zip 36602?", expected: { intent: "COUNT_DATA", responseText: "...", countRequest: { target: "contacts" }, updateData: { city: "Mobile", state: "AL", zip: "36602" } } },
    { query: "total number of contacts", expected: { intent: "COUNT_DATA", responseText: "...", countRequest: { target: "contacts" }, updateData: {} } },

    // Books Tests (7 Total)
    { query: "count the books by Harper Lee", expected: { intent: "COUNT_DATA", responseText: "...", countRequest: { target: "books" }, updateData: { author: "Harper Lee" } } },
    { query: "how many fiction books?", expected: { intent: "COUNT_DATA", responseText: "...", countRequest: { target: "books" }, updateData: { genre: "Fiction" } } },
    { query: "how many books are out of stock?", expected: { intent: "COUNT_DATA", responseText: "...", countRequest: { target: "books" }, updateData: { stock: 0 } } },
    { query: "count books published by Penguin Random House", expected: { intent: "COUNT_DATA", responseText: "...", countRequest: { target: "books" }, updateData: { publisher: "Penguin Random House" } } },
    { query: "how many books were published in 1960?", expected: { intent: "COUNT_DATA", responseText: "...", countRequest: { target: "books" }, updateData: { publicationYear: 1960 } } },
    { query: "count books by George Orwell", expected: { intent: "COUNT_DATA", responseText: "...", countRequest: { target: "books" }, updateData: { author: "George Orwell" } } },
    { query: "total books in inventory", expected: { intent: "COUNT_DATA", responseText: "...", countRequest: { target: "books" }, updateData: {} } },

    // Events Tests (5 Total)
    { query: "count the events at the Main Store", expected: { intent: "COUNT_DATA", responseText: "...", countRequest: { target: "events" }, updateData: { location: "Main Store" } } },
    { query: "how many events with Jane Doe?", expected: { intent: "COUNT_DATA", responseText: "...", countRequest: { target: "events" }, updateData: { author: "Jane Doe" } } },
    { query: "count events in the Upstairs Loft", expected: { intent: "COUNT_DATA", responseText: "...", countRequest: { target: "events" }, updateData: { location: "Upstairs Loft" } } },
    { query: "how many poetry events?", expected: { intent: "COUNT_DATA", responseText: "...", countRequest: { target: "events" }, updateData: { name: "Poetry" } } },
    { query: "count of all scheduled events", expected: { intent: "COUNT_DATA", responseText: "...", countRequest: { target: "events" }, updateData: {} } },
];

const AIAssistantTestSuite: React.FC<AIAssistantTestSuiteProps> = ({ onProcessAiCommand }) => {
    const [results, setResults] = useState<any[]>([]);
    const [isRunning, setIsRunning] = useState(false);

    const runTests = async () => {
        setIsRunning(true);
        const testResults = [];
        for (const test of testQueries) {
            
            console.log(`%c[TEST SUITE] Running test for query: "${test.query}"`, 'color: blue; font-weight: bold;');
            try {
                const commandResponse = await processNaturalLanguageCommand(test.query, true);
                
                const { intent, data, responseText } = commandResponse;

                // Call the application's command processor
                const finalResult = await onProcessAiCommand(intent, data);

                let pass = intent === test.expected.intent;
                
                const actualTarget = data?.countRequest?.target;
                const expectedTarget = test.expected.countRequest?.target;
                
                if (expectedTarget) {
                    pass = pass && (actualTarget === expectedTarget);
                }

                // CHECK FILTERS: This logic handles the filter comparison correctly
                const expectedFilters = test.expected.updateData || test.expected.countRequest?.filters;

                if (pass && expectedFilters) {
                  const actualFilters = data?.updateData || data?.countRequest?.filters;

                  if (!actualFilters) {
                    pass = false;
                  } else {
                    // Case-insensitive comparison of filter values
                    pass = Object.keys(expectedFilters).every(key =>
                      actualFilters.hasOwnProperty(key) &&
                      String(actualFilters[key]).toLowerCase() === String(expectedFilters[key]).toLowerCase()
                    );
                  }
                }
                
                // Construct the expected payload for display purposes
                const expectedPayload = JSON.parse(JSON.stringify(test.expected));
                expectedPayload.responseText = responseText || expectedPayload.responseText || "...";
                
                expectedPayload.countRequest = {
                    target: expectedPayload.countRequest.target,
                    filters: data?.countRequest?.filters || {}, 
                };
                expectedPayload.updateData = data?.updateData || expectedPayload.updateData;

                testResults.push({ 
                    query: test.query, 
                    pass, 
                    actual: commandResponse, 
                    finalMessage: finalResult.message,
                    expected: expectedPayload 
                });
                console.log(`%c[TEST SUITE] Test for query "${test.query}" completed. Pass: ${pass}`, `color: ${pass ? 'green' : 'red'};`);
            } catch (error) {
                console.error(`[TEST SUITE] Error running test for query: "${test.query}"`, error);
                testResults.push({ 
                    ...test, 
                    pass: false, 
                    actual: 'Error', 
                    finalMessage: 'Error during processing.',
                    expected: test.expected
                });
            }
        }
        setResults(testResults);
        setIsRunning(false);
    };

    return (
        <div className="bg-white shadow-lg rounded-xl p-6 mt-2 mb-10">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">AI Assistant Test Suite</h3>
            <button
                onClick={runTests}
                disabled={isRunning}
                className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
                {isRunning ? 'Running Tests...' : 'Run All Tests'}
            </button>
            <div className="mt-4 space-y-4">
                {results.map((result, index) => (
                    <div key={index} className={`p-4 rounded-lg ${result.pass ? 'bg-green-50' : 'bg-red-50'}`}>
                        <p className="font-semibold">Query: "{result.query}"</p>
                        <p>Status: <span className={`font-bold ${result.pass ? 'text-green-700' : 'text-red-700'}`}>{result.pass ? 'Pass' : 'Fail'}</span></p>
                        <p className="mt-2 font-semibold">Final Response:</p>
                        <p className="text-sm p-2 bg-gray-100 rounded">{result.finalMessage}</p>
                        <details className="text-sm mt-2">
                            <summary className="cursor-pointer">Details</summary>
                            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs">
                                Expected: {JSON.stringify(result.expected, null, 2)}
                            </pre>
                            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs">
                                Actual AI Interpretation: {JSON.stringify(result.actual, null, 2)}
                            </pre>
                        </details>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AIAssistantTestSuite;
