// @ts-nocheck
'use client';

export default function StepRoundDetails({
  courseZip, setCourseZip,
  homeZip, setHomeZip,
  roundDate, setRoundDate,
  teeTime, setTeeTime,
  courseName, setCourseName,
  onFetch,
  fetchStatus,
  wx,
}) {
  const isLoading = fetchStatus === 'loading';

  return (
    <div className="wyc-step-content">
      <p className="eyebrow" style={{ marginBottom: 16 }}>Step 1</p>
      <h2 className="wyc-step-title">Round Details</h2>
      <p className="wyc-step-desc">
        Enter your course location and tee time to fetch live forecast data.
        Your card will be adjusted for temperature, altitude, humidity, and wind.
      </p>

      <div className="wyc-field-grid wyc-4col">
        <div className="wyc-field">
          <label className="wyc-label" htmlFor="courseZip">Course ZIP</label>
          <input
            id="courseZip"
            className="wyc-input"
            type="text"
            inputMode="numeric"
            maxLength={5}
            placeholder="90210"
            value={courseZip}
            onChange={(e) => setCourseZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
          />
        </div>
        <div className="wyc-field">
          <label className="wyc-label" htmlFor="homeZip">Home ZIP <span className="wyc-optional">(optional)</span></label>
          <input
            id="homeZip"
            className="wyc-input"
            type="text"
            inputMode="numeric"
            maxLength={5}
            placeholder="Same as course"
            value={homeZip}
            onChange={(e) => setHomeZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
          />
        </div>
        <div className="wyc-field">
          <label className="wyc-label" htmlFor="roundDate">Date</label>
          <input
            id="roundDate"
            className="wyc-input"
            type="date"
            value={roundDate}
            onChange={(e) => setRoundDate(e.target.value)}
          />
        </div>
        <div className="wyc-field">
          <label className="wyc-label" htmlFor="teeTime">Tee Time</label>
          <input
            id="teeTime"
            className="wyc-input"
            type="time"
            value={teeTime}
            onChange={(e) => setTeeTime(e.target.value)}
          />
        </div>
      </div>

      <div className="wyc-field" style={{ marginTop: 16, maxWidth: 340 }}>
        <label className="wyc-label" htmlFor="courseName">Course Name <span className="wyc-optional">(optional)</span></label>
        <input
          id="courseName"
          className="wyc-input"
          type="text"
          placeholder="Auto-filled from ZIP"
          value={courseName}
          onChange={(e) => setCourseName(e.target.value)}
        />
      </div>

      <button
        className="wyc-btn-primary"
        style={{ marginTop: 24 }}
        onClick={onFetch}
        disabled={courseZip.length !== 5 || isLoading}
      >
        {isLoading ? 'Fetching Forecast…' : 'Fetch Forecast →'}
      </button>

      {fetchStatus === 'error' && (
        <p className="wyc-error">Could not fetch weather. Check your ZIP code and try again.</p>
      )}

      {wx && fetchStatus === 'success' && (
        <div className="wyc-weather-preview">
          <p className="wyc-preview-label section-label" style={{ marginBottom: 12 }}>Forecast at Tee Time</p>
          <div className="wyc-wx-grid">
            <div className="wyc-wx-cell">
              <span className="wyc-wx-val" style={{ color: 'var(--color-primary)' }}>{wx.tempF}°F</span>
              <span className="wyc-wx-key">Temperature</span>
            </div>
            <div className="wyc-wx-cell">
              <span className="wyc-wx-val">{wx.humidity}%</span>
              <span className="wyc-wx-key">Humidity</span>
            </div>
            <div className="wyc-wx-cell">
              <span className="wyc-wx-val" style={{ color: 'var(--color-primary)' }}>{wx.windMph} mph</span>
              <span className="wyc-wx-key">Wind Speed</span>
            </div>
            <div className="wyc-wx-cell">
              <span className="wyc-wx-val">{wx.windDirText}</span>
              <span className="wyc-wx-key">Direction</span>
            </div>
            <div className="wyc-wx-cell">
              <span className="wyc-wx-val">{wx.altFt.toLocaleString()} ft</span>
              <span className="wyc-wx-key">Elevation</span>
            </div>
            <div className="wyc-wx-cell">
              <span className="wyc-wx-val">
                {wx.altFt !== wx.homeAltFt
                  ? `${wx.altFt > wx.homeAltFt ? '+' : ''}${Math.round(((wx.altFt - wx.homeAltFt) / wx.homeAltFt) * 100)}%`
                  : '—'}
              </span>
              <span className="wyc-wx-key">Alt Δ</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
