// Function to fetch and parse train data for a specific station and destination
async function fetchAndParseStationData(stationName, stationCode, targetDestination) {
    const bartUrl = `https://www.bart.gov/schedules/eta_schedule/${stationCode}`;
    const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(bartUrl);
    let trains = [];

    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseData = await response.json();
        let htmlContent;

        if (responseData && responseData.html) {
            htmlContent = responseData.html;
        } else {
            htmlContent = await response.text();
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

        const schedulesRealtimeResultsDiv = doc.querySelector('.schedules-realtime-results');

        if (schedulesRealtimeResultsDiv) {
            const scheduleRoutes = schedulesRealtimeResultsDiv.querySelectorAll('.schedule-route');

            scheduleRoutes.forEach(routeDiv => {
                const destinationAnchor = routeDiv.querySelector('.schedule-route-title a');
                if (destinationAnchor) {
                    const currentDestination = destinationAnchor.textContent.trim();

                    if (currentDestination.includes(targetDestination)) {
                        const timeStops = routeDiv.querySelectorAll('.schedule-route-stop strong');
                        timeStops.forEach(timeStrong => {
                            const minutes = timeStrong.textContent.trim();
                            trains.push({
                                origin: stationName,
                                destination: currentDestination,
                                minutes: minutes
                            });
                        });
                    }
                }
            });
        } else {
            console.warn(`Could not find .schedules-realtime-results div for ${stationName}.`);
        }
    } catch (error) {
        console.error(`Error fetching or parsing data for ${stationName}:`, error);
    }
    return trains;
}

// Main function to fetch and display all train data
async function fetchAllTrainData() {
    const trainInfoDiv = document.getElementById('train-info');
    const lastUpdatedSpan = document.getElementById('last-updated');

    trainInfoDiv.innerHTML = `
        <div class="loading-spinner"></div>
        <p class="text-gray-600 mt-2">Loading train data...</p>
    `;

    let allTrains = [];

    // Fetch data for Montgomery Street to Berryessa
    const montgomeryTrains = await fetchAndParseStationData('Montgomery Street', 'MONT', 'Berryessa');
    allTrains = allTrains.concat(montgomeryTrains);

    // Fetch data for Milpitas to Daly City
    const milpitasTrains = await fetchAndParseStationData('Milpitas', 'MLPT', 'Daly City');
    allTrains = allTrains.concat(milpitasTrains);

    // Sort trains by minutes for a cleaner display
    allTrains.sort((a, b) => {
        const aMin = parseInt(a.minutes);
        const bMin = parseInt(b.minutes);
        if (isNaN(aMin) && isNaN(bMin)) return 0; // Both are "Arriving" or "Departed"
        if (isNaN(aMin)) return 1; // "Arriving" or "Departed" comes after numbers
        if (isNaN(bMin)) return -1;
        return aMin - bMin;
    });


    // Clear previous content
    trainInfoDiv.innerHTML = '';

    if (allTrains.length > 0) {
        // Group trains by origin station for better readability
        const groupedTrains = allTrains.reduce((acc, train) => {
            if (!acc[train.origin]) {
                acc[train.origin] = [];
            }
            acc[train.origin].push(train);
            return acc;
        }, {});

        for (const station in groupedTrains) {
            const stationSection = document.createElement('div');
            stationSection.className = 'station-section';
            stationSection.innerHTML = `<h2 class="station-title">${station} Station</h2>`;

            if (groupedTrains[station].length > 0) {
                groupedTrains[station].forEach(train => {
                    const trainItem = document.createElement('div');
                    trainItem.className = 'train-item flex-col sm:flex-row items-start sm:items-center';
                    trainItem.innerHTML = `
                        <div class="flex justify-between w-full sm:w-auto sm:flex-grow mb-2 sm:mb-0">
                            <span class="destination-origin">To ${train.destination}</span>
                            <span class="minutes">${train.minutes}</span>
                        </div>
                    `;
                    stationSection.appendChild(trainItem);
                });
            } else {
                stationSection.innerHTML += `<p class="no-trains">No trains to ${groupedTrains[station][0].destination} found at this time from ${station}.</p>`;
            }
            trainInfoDiv.appendChild(stationSection);
        }

    } else {
        trainInfoDiv.innerHTML = '<p class="no-trains">No relevant train data found at this time.</p>';
    }

    lastUpdatedSpan.textContent = new Date().toLocaleTimeString();
}

// Fetch data immediately on page load
fetchAllTrainData();

// Set up interval to refresh data every 30 seconds (30000 milliseconds)
setInterval(fetchAllTrainData, 30000);
