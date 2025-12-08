document.getElementById('checkButton').addEventListener('click', handleCheck);
document.getElementById('addressInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleCheck();
});

// Google Sheets CSV Export URLs (Gviz endpoints for reliability)
const GAS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1C8lYF4SLypPUI2UDj62xIZ8EG-gdrCT9Zagcg67eMaY/gviz/tq?tqx=out:csv';
const WATER_ELECTRIC_CSV_URL = 'https://docs.google.com/spreadsheets/d/1SKgbnqZxWU-888xFQ1WXciQj9Hi2EX6E5gfCPwcvQ/gviz/tq?tqx=out:csv&gid=1148111753';

// Helper for Network Requests with Timeout
async function fetchWithTimeout(url, options = {}, timeout = 5000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

async function fetchAndParseData(url, fallbackText) {
    try {
        const response = await fetchWithTimeout(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const text = await response.text();
        return Papa.parse(text, { header: false }).data;
    } catch (error) {
        console.warn(`Fetch failed for ${url} (Timeout/Error), using fallback data.`, error);
        if (typeof fallbackText !== 'undefined') {
            return Papa.parse(fallbackText, { header: false }).data;
        }
        return [];
    }
}

async function handleCheck() {
    const address = document.getElementById('addressInput').value.trim();
    if (!address) return;

    const resultArea = document.getElementById('resultArea');
    const resultContent = document.getElementById('resultContent');
    const loading = document.getElementById('loading');
    const utilityArea = document.getElementById('utilityInfo');

    resultArea.classList.remove('hidden');
    loading.classList.remove('hidden');
    resultContent.innerHTML = '';
    if (utilityArea) utilityArea.innerHTML = '';

    try {
        // 1. Geocoding
        const coords = await getCoordinates(address);
        if (!coords) {
            throw new Error('住所が見つかりませんでした。');
        }

        // 2. Find Nearest Stations
        const stations = await getNearestStations(coords.lat, coords.lon);
        if (!stations || stations.length === 0) {
            throw new Error('近くに駅が見つかりませんでした。');
        }

        // 3. Check Tokyu
        const isTokyu = checkIsTokyu(stations);

        // 4. Render Main Result
        renderResult(stations, isTokyu);

        // 5. Utility Info (Async)
        await updateUtilityInfo(address);

    } catch (error) {
        resultContent.innerHTML = `<p style="color: red;">エラー: ${error.message}</p>`;
    } finally {
        loading.classList.add('hidden');
    }
}

async function getCoordinates(address) {
    const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(address)}`;
    try {
        const response = await fetchWithTimeout(url);
        if (!response.ok) throw new Error(`Geocoding API Error: ${response.status}`);
        const data = await response.json();
        if (data && data.length > 0) {
            const coords = data[0].geometry.coordinates;
            return { lon: coords[0], lat: coords[1] };
        }
    } catch (e) {
        console.error("Geocoding error:", e);
    }
    return null;
}

async function getNearestStations(lat, lon) {
    const url = `https://express.heartrails.com/api/json?method=getStations&x=${lon}&y=${lat}`;
    try {
        const response = await fetchWithTimeout(url);
        if (!response.ok) throw new Error(`Station API Error: ${response.status}`);
        const data = await response.json();
        if (data && data.response && data.response.station) {
            return data.response.station;
        }
    } catch (e) {
        console.error("Station fetch error:", e);
    }
    return null;
}

function checkIsTokyu(stations) {
    if (!stations || stations.length === 0) return false;
    const nearestStationName = stations[0].name;
    const matchingStations = stations.filter(s => s.name === nearestStationName);
    return matchingStations.some(s => s.line.includes('東急'));
}

function renderResult(stations, isTokyu) {
    const resultContent = document.getElementById('resultContent');
    const resultArea = document.getElementById('resultArea');

    const nearestStation = stations[0];
    const matchingStations = stations.filter(s => s.name === nearestStation.name);
    const allLines = [...new Set(matchingStations.map(s => s.line))].join('、');

    resultArea.className = isTokyu ? 'result-success' : 'result-failure';
    resultArea.classList.remove('hidden');

    let html = `
        <div class="station-name">最寄り駅: ${nearestStation.name}駅</div>
        <div class="lines">路線: ${allLines}</div>
        <div class="distance">距離: およそ ${nearestStation.distance}m</div>
    `;

    const tokyuLine = matchingStations.find(s => s.line.includes('東急'))?.line || '東急線';

    if (isTokyu) {
        html += `
            <div class="talk-script">
                <h3>🎉 東急沿線判定: OK</h3>
                <p>最寄り駅は<strong>${nearestStation.name}駅</strong>で間違いないでしょうか。</p>
                <p>あ、そうしましたら<br>
                <strong>${tokyuLine}</strong>になりますので、東急グループの、電気（ガス）がよろしいかとおもいまして</p>

                <div style="margin-top:15px; font-weight:bold; color:#444;">【東急でんき】N+1営業日+1</div>
                <p>まず、電気に関しては基本料金が無料で、電気の使用料金だけで使えます、東急グループのでんきの、ライフフィットプランでご案内させていただいております。</p>
                <p>毎日ウェブで時間帯ごとの料金が確認できますので、お客様ご自身で電気代の節約ができるプランになっております。</p>
                <p>もちろん初期費用や違約金などもございませんので、使ってみて合わなければお乗り換えができますし、<br>
                設備は地域電力の設備のままですので、電力が弱くなったり、停電になるなどのご心配はございませんのでご安心ください。</p>

                <div style="margin-top:15px; font-weight:bold; color:#444;">【東急ガス】（東京ガスエリアのガスのみ取次のみ案内）！オール電化、LPガス、プロパンガス記載ないか要チェック！※N+5営業日～</div>
                <p>ガスに関して、確認で申し訳ございませんがこちらの物件プロパンガスという案内はございましたでしょうか。（なし）</p>
                <p>そうしましたら、こちら東京ガスの設備をそのまま使って提供している、東急ガスの対応物件にもなってまして、電気とまとめて請求でご利用いただけるようになっております。</p>

                <div style="margin-top:15px; font-weight:bold; color:#444;">（共通クロージング）</div>
                <p>また、東急線沿いのお客様ですとTOKYU CARDのクレジットカードをご利用されてる方も多く、<br>
                でんき代・ガス代をこちらのカードで支払うとTOKYU POINTが最大1.5％貯まります。</p>
                <p>また、電車で通勤・通学されるかたですと、<br>
                定期券割というものもございまして、東急の定期券をお持ちの方なら、お手続きをしていただけると、適用になった場合東急でんき＆ガスのご利用料金から毎月55円ずつ、合わせて110円の割引が2年間入りますので<br>
                こちらも含めてお喜びいただけるかと思います。</p>
                <p>問題なければ、みなさま同様こちらの東急パワーサプライが提供する東急でんき・ガスでお手配すすめてもよろしいでしょうか。</p>
            </div>
        `;
    } else {
        html += `
            <div class="talk-script" style="border-left-color: #666; background: #fdfdfd;">
                <h3>東急沿線ではありません</h3>
                <p>
                    （トークスクリプトは表示されません）
                </p>
            </div>
        `;
    }

    resultContent.innerHTML = html;
}

async function updateUtilityInfo(address) {
    const utilityArea = document.getElementById('utilityInfo');
    if (!utilityArea) return;

    try {
        // Fetch Data
        const [gasData, weData] = await Promise.all([
            fetchAndParseData(GAS_CSV_URL, typeof GAS_CSV_TEXT !== 'undefined' ? GAS_CSV_TEXT : undefined),
            fetchAndParseData(WATER_ELECTRIC_CSV_URL, typeof WE_CSV_TEXT !== 'undefined' ? WE_CSV_TEXT : undefined)
        ]);

        const utilities = resolveUtilities(address, gasData, weData);
        renderUtilityInfo(utilities, utilityArea);

    } catch (e) {
        console.error("Utility update error:", e);
        utilityArea.innerHTML = `<p style="color:red; font-size:0.8rem;">ユーティリティ情報の取得に失敗しました。</p>`;
    }
}


function resolveUtilities(address, gasData, weData) {
    // Default structure
    const utilities = {
        gas: { name: '情報なし', phone: '-' },
        water: { name: '情報なし', phone: '-' },
        electric: { name: '東京電力エナジーパートナー', phone: '0120-995-001' }
    };

    const normAddr = address.replace(/[ －\u3000-]/g, ''); // Normalize

    // --- water/Electric Matching ---
    // CSV Cols: 2=Pref, 3=City, 4=Town, 5=ElecPhone, 6=WaterName, 7=WaterPhone
    // Filter matches
    const weMatches = weData.filter(row => {
        if (!row || row.length < 5) return false;
        const pref = row[2] || '';
        const city = row[3] || '';
        const town = row[4] || '';
        if (!city) return false; // Skip invalid rows

        // Check inclusion
        const fullLoc = pref + city + town;
        const cityLoc = city + town;

        return normAddr.includes(fullLoc) || normAddr.includes(cityLoc);
    });

    // Sort by length of match key (descending) to get most specific match
    weMatches.sort((a, b) => {
        const lenA = (a[2] || '').length + (a[3] || '').length + (a[4] || '').length;
        const lenB = (b[2] || '').length + (b[3] || '').length + (b[4] || '').length;
        return lenB - lenA;
    });

    if (weMatches.length > 0) {
        const best = weMatches[0];
        if (best[6]) utilities.water.name = best[6];
        if (best[7]) utilities.water.phone = best[7];
        if (best[5]) utilities.electric.phone = best[5];
    }

    // --- Gas Matching ---
    // CSV Cols: 2=Provider, 3=Pref, 4=City, 5=Town
    const gasMatches = gasData.filter(row => {
        if (!row || row.length < 5) return false;
        const pref = row[3] || '';
        const city = row[4] || '';
        const town = row[5] || '';
        if (!city) return false;

        const fullLoc = pref + city + town;
        const cityLoc = city + town;

        return normAddr.includes(fullLoc) || normAddr.includes(cityLoc);
    });

    gasMatches.sort((a, b) => {
        const lenA = (a[3] || '').length + (a[4] || '').length + (a[5] || '').length;
        const lenB = (b[3] || '').length + (b[4] || '').length + (b[5] || '').length;
        return lenB - lenA;
    });

    if (gasMatches.length > 0) {
        const best = gasMatches[0];
        utilities.gas.name = best[2];

        // Phone Heuristics
        if (best[2].includes('大東ガス')) utilities.gas.phone = '0120-135-616';
        else if (best[2].includes('東京ガス')) utilities.gas.phone = '0570-002211';
        else if (best[2].includes('武州ガス')) utilities.gas.phone = '049-241-9000';
        else if (best[2].includes('角栄ガス')) utilities.gas.phone = '049-231-1511';
        else if (best[2].includes('東部ガス')) utilities.gas.phone = '029-231-2241';
        else if (best[2].includes('ニチガス')) utilities.gas.phone = '0120-412-609';
        else if (best[2].includes('レモンガス')) utilities.gas.phone = '0120-302-522';
    }

    return utilities;
}

function renderUtilityInfo(utilities, container) {
    if (!container) return;

    container.classList.remove('hidden');
    container.innerHTML = `
        <div class="utility-group">
            <div class="utility-label">電気（送配電）</div>
            <div class="utility-value">
                ${utilities.electric.name}
                ${utilities.electric.phone && utilities.electric.phone !== '-' ? `<a href="tel:${utilities.electric.phone}" class="utility-phone">📞 ${utilities.electric.phone}</a>` : ''}
            </div>
        </div>
        <div class="utility-group">
            <div class="utility-label">水道</div>
            <div class="utility-value">
                ${utilities.water.name}
                ${utilities.water.phone && utilities.water.phone !== '-' ? `<a href="tel:${utilities.water.phone}" class="utility-phone">📞 ${utilities.water.phone}</a>` : ''}
            </div>
        </div>
        <div class="utility-group">
            <div class="utility-label">ガス（導管）</div>
            <div class="utility-value">
                ${utilities.gas.name}
                ${utilities.gas.phone && utilities.gas.phone !== '-' ? `<a href="tel:${utilities.gas.phone}" class="utility-phone">📞 ${utilities.gas.phone}</a>` : ''}
            </div>
            ${utilities.gas.name === '情報なし' || utilities.gas.name === '不明' ?
            `<div style="margin-top:4px;"><a href="https://www.gas.or.jp/jigyosya/" target="_blank" class="utility-link">ガス事業者検索（日本ガス協会）</a></div>` : ''}
        </div>
    `;
}
