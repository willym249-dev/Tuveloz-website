"use client";
/* eslint-disable @next/next/no-img-element -- private provider media uses session-gated R2 routes */

import { FormEvent, useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { ConfirmAction } from "./confirm-action";
import { BrandMark, TuvelozIcon } from "./tuveloz-icons";
import { providerModeForWorkLocations } from "../../lib/service-matching";

type Profile = {
  id: string;
  slug: string;
  businessName: string;
  headline: string;
  about: string;
  yearsExperience: string;
  availabilityStatus: string;
  availabilityNote: string;
  businessHours: string;
  publicStatus: string;
  hasLogo: boolean;
};

type GalleryItem = {
  id: string;
  caption: string;
  service: string;
  createdAt: string;
};

type ProviderReview = {
  id: string;
  customerDisplayName: string;
  service: string;
  rating: number;
  comment: string;
  createdAt: string;
};

type ProfileResponse = {
  profile: Profile;
  gallery: GalleryItem[];
  services: string[];
  serviceArea: string;
  workLocations: string;
  businessMunicipality: string;
  canPublish: boolean;
  testProvider: boolean;
  reviewSummary: { average: number; count: number };
  reviews: ProviderReview[];
  profileHealth: {
    score: number;
    improvements: string[];
  };
  analytics: {
    profileViews: number;
    qrScans: number;
    quotesSent: number;
    acceptedQuotes: number;
    decidedQuotes: number;
    pendingQuotes: number;
    quoteWinRate: number | null;
    declineFeedback: Array<{ value: string; label: string; count: number }>;
  };
  error?: string;
};

const emptyProfile: Profile = {
  id: "",
  slug: "",
  businessName: "",
  headline: "",
  about: "",
  yearsExperience: "",
  availabilityStatus: "Available now",
  availabilityNote: "",
  businessHours: "",
  publicStatus: "draft",
  hasLogo: false,
};

const printableCardSlots = Array.from({ length: 10 }, (_, index) => index);

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "TV";
}

function profileErrorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}

type ProviderBusinessFocus = "profile" | "reviews" | "performance";

export function ProviderBusinessPage({ focus = "profile" }: { focus?: ProviderBusinessFocus }) {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingAction, setPendingAction] = useState<
    "" | "profile" | "upload-logo" | "upload-gallery"
  >("");
  const [pendingRemovalId, setPendingRemovalId] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrError, setQrError] = useState("");
  const activeQrSlug = data?.canPublish && data.profile.publicStatus === "published"
    ? data.profile.slug
    : "";
  const qrTargetUrl = activeQrSlug && typeof window !== "undefined"
    ? `${window.location.origin}/q/${encodeURIComponent(activeQrSlug)}`
    : "";

  const applyResponse = useCallback((next: ProfileResponse) => {
    setData(next);
    setProfile(next.profile);
  }, []);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/provider-profile", { cache: "no-store" });
      const result = await response.json().catch(() => ({})) as ProfileResponse;
      if (!response.ok) throw new Error(result.error || "Unable to load your business page.");
      if (!result.profile) throw new Error("The business page returned incomplete profile data.");
      applyResponse(result);
    } catch (reason) {
      setError(profileErrorMessage(reason, "Unable to load your business page."));
    } finally {
      setLoading(false);
    }
  }, [applyResponse]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadProfile();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadProfile]);

  useEffect(() => {
    if (!activeQrSlug) return;
    let active = true;
    const targetUrl = `${window.location.origin}/q/${encodeURIComponent(activeQrSlug)}`;
    QRCode.toDataURL(targetUrl, {
      color: { dark: "#07182D", light: "#FFFFFFFF" },
      errorCorrectionLevel: "M",
      margin: 2,
      width: 512,
    }).then((result) => {
      if (active) {
        setQrDataUrl(result);
        setQrError("");
      }
    }).catch(() => {
      if (active) setQrError("Unable to create the QR image right now.");
    });
    return () => {
      active = false;
    };
  }, [activeQrSlug]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingAction !== "profile") {
      setPendingAction("profile");
      return;
    }
    setBusy("profile");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/provider-profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "save-profile", ...profile }),
      });
      const result = await response.json().catch(() => ({})) as ProfileResponse;
      if (!response.ok) throw new Error(result.error || "Unable to save your business page.");
      if (!result.profile) throw new Error("The saved business page returned incomplete profile data.");
      applyResponse(result);
      setNotice(result.profile.publicStatus === "pending_review"
        ? "Profile saved and submitted for TUVELOZ content review. It stays private until approved."
        : result.profile.publicStatus === "published"
          ? "Business page saved. Its reviewed content remains public."
          : "Private draft saved.");
    } catch (reason) {
      setError(profileErrorMessage(reason, "Unable to save your business page."));
    } finally {
      setBusy("");
      setPendingAction("");
    }
  }

  async function uploadMedia(event: FormEvent<HTMLFormElement>, action: "upload-logo" | "upload-gallery") {
    event.preventDefault();
    const form = event.currentTarget;
    if (pendingAction !== action) {
      setPendingAction(action);
      return;
    }
    setBusy(action);
    setError("");
    setNotice("");
    const formData = new FormData(form);
    formData.set("action", action);
    try {
      const response = await fetch("/api/provider-profile", { method: "POST", body: formData });
      const result = await response.json().catch(() => ({})) as ProfileResponse;
      if (!response.ok) throw new Error(result.error || "Unable to upload that image.");
      if (!result.profile) throw new Error("The image upload returned incomplete profile data.");
      applyResponse(result);
      form.reset();
      setNotice(action === "upload-logo" ? "Business logo updated." : "Work photo added.");
    } catch (reason) {
      setError(profileErrorMessage(reason, "Unable to upload that image."));
    } finally {
      setBusy("");
      setPendingAction("");
    }
  }

  async function removeGallery(galleryId: string) {
    setBusy(galleryId);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/provider-profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "remove-gallery", galleryId }),
      });
      const result = await response.json().catch(() => ({})) as ProfileResponse;
      if (!response.ok) throw new Error(result.error || "Unable to remove that photo.");
      if (!result.profile) throw new Error("The photo removal returned incomplete profile data.");
      applyResponse(result);
      setNotice("Work photo removed.");
    } catch (reason) {
      setError(profileErrorMessage(reason, "Unable to remove that photo."));
    } finally {
      setBusy("");
      setPendingRemovalId("");
    }
  }

  async function copyPublicLink() {
    const url = `${window.location.origin}/providers/${profile.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Public business-page link copied.");
    } catch {
      setError("Unable to copy the link. Open the page and copy it from your browser.");
    }
  }

  async function copyQrLink() {
    if (!qrTargetUrl) return;
    try {
      await navigator.clipboard.writeText(qrTargetUrl);
      setNotice("QR scan link copied.");
    } catch {
      setError("Unable to copy the QR link. Open it and copy it from your browser.");
    }
  }

  async function refreshPrivateNumbers() {
    setBusy("qr-metrics");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/provider-profile", { cache: "no-store" });
      const result = await response.json().catch(() => ({})) as ProfileResponse;
      if (!response.ok) throw new Error(result.error || "Unable to refresh your private numbers.");
      if (!result.profile) throw new Error("The private-number refresh returned incomplete profile data.");
      applyResponse(result);
      setNotice("Private numbers refreshed.");
    } catch (reason) {
      setError(profileErrorMessage(reason, "Unable to refresh your private numbers."));
    } finally {
      setBusy("");
    }
  }

  function printBusinessCards() {
    if (!qrDataUrl || !activeQrSlug) return;
    setError("");
    setNotice("Opening a print-ready sheet with 10 business cards.");
    window.print();
  }

  function setField<K extends keyof Profile>(field: K, value: Profile[K]) {
    setPendingAction("");
    setProfile((current) => ({ ...current, [field]: value }));
  }

  if (loading) {
    const loadingLabel = focus === "reviews"
      ? "Loading completed-job reviews…"
      : focus === "performance"
        ? "Loading private performance tools…"
        : "Loading your business profile…";
    return <section className="provider-business-page" id="business-page"><p className="admin-note">{loadingLabel}</p></section>;
  }
  if (!data) {
    return (
      <section className="provider-business-page provider-business-error" id="business-page" role="alert">
        <h2>Business tools could not load.</h2>
        <p className="form-error">{error || "Unable to load your business tools right now."}</p>
        <button className="button secondary" onClick={() => void loadProfile()} type="button">
          Try again
        </button>
      </section>
    );
  }

  const publicUrl = `/providers/${profile.slug}`;
  const privatePreviewUrl = publicUrl;
  const displayLocation = data.businessMunicipality || data.serviceArea || "Local service area";
  const displayProfileUrl = activeQrSlug
    ? `tuveloz.com/providers/${activeQrSlug}`
    : "";
  return (
    <section className="provider-business-page" id="business-page">
      {focus === "profile" && (
        <>
      <div className="business-page-heading">
        <div>
          <span className="kicker">Digital Garage</span>
          <h2>Your Tuveloz business page</h2>
          <p>You control the details. Tuveloz keeps every page clean, consistent, and professional.</p>
        </div>
        <div className={`page-status ${profile.publicStatus}`}>
          <span>{profile.publicStatus === "published"
            ? "Public · content reviewed"
            : profile.publicStatus === "pending_review"
              ? "Private · review pending"
              : "Private draft"}</span>
          <strong>{data.reviewSummary.count ? `${data.reviewSummary.average} ★` : "New profile"}</strong>
        </div>
      </div>

      <nav className="business-page-tabs" aria-label="Business page sections">
        <span><TuvelozIcon name="overview" />Overview</span>
        <span><TuvelozIcon name="services" />Services</span>
        <span><TuvelozIcon name="gallery" />Work Gallery</span>
        <span><TuvelozIcon name="reviews" />Reviews</span>
      </nav>

      <div className="business-page-layout">
        <form className="business-profile-form" onSubmit={saveProfile}>
          <div className="provider-profile-preview" aria-label="Live customer preview">
            <div className="provider-profile-preview-heading">
              <span className="kicker">Live customer preview</span>
              <small>Updates while you edit</small>
            </div>
            <div className="provider-profile-preview-identity">
              {profile.hasLogo && profile.id ? (
                <img
                  src={`/api/provider-media?profileId=${encodeURIComponent(profile.id)}`}
                  alt=""
                />
              ) : (
                <span aria-hidden="true">{initials(profile.businessName)}</span>
              )}
              <div>
                <strong>{profile.businessName || "Your business name"}</strong>
                <p>{profile.headline || "Add a clear one-line description of your vehicle services."}</p>
              </div>
            </div>
            <div className="provider-profile-preview-facts">
              <span className="provider-mode-badge">
                {providerModeForWorkLocations(data.workLocations)}
              </span>
              <span>{profile.availabilityStatus}</span>
              <span>{profile.yearsExperience || "Add experience"}</span>
              <span>{data.services.length} currently listed {data.services.length === 1 ? "service" : "services"}</span>
              <span>{displayLocation}</span>
            </div>
            <p className="provider-profile-preview-note">
              If approved for publication, customers see currently eligible service listings,
              provider-supplied work photos, and reviews linked to completed Tuveloz jobs.
            </p>
          </div>

          <div className="business-form-section">
            <div className="business-form-title">
              <span>01</span>
              <div><strong>Public identity</strong><small>What customers see first</small></div>
            </div>
            <label>
              Business name
              <input
                required
                maxLength={120}
                value={profile.businessName}
                onChange={(event) => setField("businessName", event.target.value)}
              />
            </label>
            <label>
              One-line description
              <input
                maxLength={120}
                placeholder="Mobile vehicle help with clear, upfront quotes"
                value={profile.headline}
                onChange={(event) => setField("headline", event.target.value)}
              />
              <small>Keep it short and specific. This appears under your business name.</small>
            </label>
            <label>
              About
              <textarea
                maxLength={900}
                placeholder="Tell customers what you do well, how you work, and what they can expect."
                rows={5}
                value={profile.about}
                onChange={(event) => setField("about", event.target.value)}
              />
            </label>
            <label>
              Experience
              <input
                maxLength={80}
                placeholder="Example: 8 years"
                value={profile.yearsExperience}
                onChange={(event) => setField("yearsExperience", event.target.value)}
              />
            </label>
          </div>

          <div className="business-form-section">
            <div className="business-form-title">
              <span>02</span>
              <div><strong>Availability</strong><small>Simple, provider-controlled status</small></div>
            </div>
            <div className="business-form-grid">
              <label>
                Current status
                <select
                  value={profile.availabilityStatus}
                  onChange={(event) => setField("availabilityStatus", event.target.value)}
                >
                  <option>Available now</option>
                  <option>Busy</option>
                  <option>Off duty</option>
                </select>
              </label>
              <label>
                Availability note
                <input
                  maxLength={160}
                  placeholder="Example: Open Saturday 9–4"
                  value={profile.availabilityNote}
                  onChange={(event) => setField("availabilityNote", event.target.value)}
                />
              </label>
            </div>
            <label>
              Typical business hours
              <input
                maxLength={220}
                placeholder="Example: Mon–Fri 8–6 · Sat 9–3"
                value={profile.businessHours}
                onChange={(event) => setField("businessHours", event.target.value)}
              />
            </label>
          </div>

          <div className="business-form-section publish-section">
            <div className="business-form-title">
              <span>03</span>
              <div><strong>Page visibility</strong><small>Publication requires TUVELOZ content review</small></div>
            </div>
            <label className="publish-choice">
              <input
                checked={profile.publicStatus !== "draft"}
                disabled={!data.canPublish}
                type="checkbox"
                onChange={(event) => setField("publicStatus", event.target.checked ? "published" : "draft")}
              />
              <span>
                <strong>Publish my business page</strong>
                <small>{data.canPublish
                  ? profile.publicStatus === "pending_review"
                    ? "Your current version stays private while TUVELOZ reviews provider-written claims and media."
                    : "Submitting changes sends the exact profile version for review before customers can see it."
                  : "Test profiles and profiles without current service eligibility stay private."}</small>
              </span>
            </label>
            {pendingAction === "profile" ? (
              <ConfirmAction
                busy={busy === "profile"}
                confirmLabel={profile.publicStatus !== "draft" ? "Confirm review request" : "Confirm and save"}
                confirmType="submit"
                message={profile.publicStatus !== "draft"
                  ? "These changes will stay private until TUVELOZ reviews and approves this exact profile version."
                  : "These changes will be saved to your private draft."}
                onBack={() => setPendingAction("")}
                title={profile.publicStatus !== "draft" ? "Submit this version for review?" : "Save these changes?"}
              />
            ) : (
              <button className="button primary" disabled={busy === "profile"} type="submit">
                {busy === "profile" ? "Saving…" : profile.publicStatus !== "draft" ? "Save and submit for review" : "Save draft"}
              </button>
            )}
          </div>
        </form>

        <aside className="business-media-panel">
          <section>
            <div className="business-form-title">
              <span>A</span>
              <div><strong>Business logo</strong><small>Square image works best</small></div>
            </div>
            {profile.hasLogo && profile.id && (
              <img
                className="business-logo-preview"
                src={`/api/provider-media?profileId=${encodeURIComponent(profile.id)}`}
                alt="Current business logo"
              />
            )}
            <form
              onChange={() => pendingAction === "upload-logo" && setPendingAction("")}
              onSubmit={(event) => uploadMedia(event, "upload-logo")}
            >
              <input required name="image" type="file" accept="image/jpeg,image/png,image/webp" />
              <small>JPG, PNG, or WebP · maximum 8 MB.</small>
              {pendingAction === "upload-logo" ? (
                <ConfirmAction
                  busy={busy === "upload-logo"}
                  busyLabel="Uploading…"
                  confirmLabel="Confirm upload"
                  confirmType="submit"
                  message="This image will become your business logo."
                  onBack={() => setPendingAction("")}
                  title={profile.hasLogo ? "Replace your logo?" : "Add this logo?"}
                />
              ) : (
                <button className="button secondary" disabled={busy === "upload-logo"} type="submit">
                  {busy === "upload-logo" ? "Uploading…" : profile.hasLogo ? "Replace logo" : "Add logo"}
                </button>
              )}
            </form>
          </section>

          <section>
            <div className="business-form-title">
              <span>B</span>
              <div><strong>Work Gallery</strong><small>Up to 12 provider-selected photos</small></div>
            </div>
            <form
              onChange={() => pendingAction === "upload-gallery" && setPendingAction("")}
              onSubmit={(event) => uploadMedia(event, "upload-gallery")}
            >
              <input required name="image" type="file" accept="image/jpeg,image/png,image/webp" />
              <select name="service" defaultValue="">
                <option value="">Choose a service (optional)</option>
                {data.services.map((service) => <option key={service}>{service}</option>)}
              </select>
              <input name="caption" maxLength={180} placeholder="Short description of the work" />
              <small>Share only work you have permission to show. Avoid faces, addresses, and visible license plates.</small>
              {pendingAction === "upload-gallery" ? (
                <ConfirmAction
                  busy={busy === "upload-gallery"}
                  busyLabel="Uploading…"
                  confirmLabel="Confirm upload"
                  confirmType="submit"
                  message="This photo will be added to your customer-facing work gallery."
                  onBack={() => setPendingAction("")}
                  title="Add this work photo?"
                />
              ) : (
                <button className="button secondary" disabled={busy === "upload-gallery"} type="submit">
                  {busy === "upload-gallery" ? "Uploading…" : "Add work photo"}
                </button>
              )}
            </form>
            {data.gallery.length ? (
              <div className="business-gallery-list">
                {data.gallery.map((item) => (
                  <article key={item.id}>
                    <img
                      src={`/api/provider-media?galleryId=${encodeURIComponent(item.id)}`}
                      alt={item.caption || "Work gallery item"}
                    />
                    <div className="business-gallery-copy">
                      <strong>{item.caption || "Work photo"}</strong>
                      <span>{item.service || "Uncategorized"}</span>
                    </div>
                    {pendingRemovalId === item.id ? (
                      <ConfirmAction
                        busy={busy === item.id}
                        busyLabel="Removing…"
                        confirmLabel="Confirm removal"
                        message="This photo will be removed from your work gallery."
                        onBack={() => setPendingRemovalId("")}
                        onConfirm={() => removeGallery(item.id)}
                        title="Remove this photo?"
                      />
                    ) : (
                      <button
                        disabled={busy === item.id}
                        onClick={() => setPendingRemovalId(item.id)}
                        type="button"
                      >{busy === item.id ? "…" : "Remove"}</button>
                    )}
                  </article>
                ))}
              </div>
            ) : <p className="business-empty">No work photos yet.</p>}
          </section>

          <section className="provider-qr-panel">
            <div className="business-form-title">
              <span>C</span>
              <div><strong>Your permanent provider QR</strong><small>One scan opens your public page</small></div>
            </div>
            {activeQrSlug ? (
              <div className="provider-qr-live">
                <div className="provider-qr-code">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt={`QR code for ${data.profile.businessName}`} />
                  ) : (
                    <span>{qrError || "Creating QR…"}</span>
                  )}
                </div>
                <div className="provider-qr-metric">
                  <span>Total QR scans</span>
                  <strong>{data.analytics.qrScans.toLocaleString()}</strong>
                  <small>Only the total is stored—no customer or device tracking.</small>
                </div>
                <div className="provider-qr-actions">
                  {qrDataUrl && (
                    <a
                      className="button primary"
                      download={`${activeQrSlug}-tuveloz-qr.png`}
                      href={qrDataUrl}
                    >
                      Download QR
                    </a>
                  )}
                  <button className="button secondary" onClick={copyQrLink} type="button">
                    Copy scan link
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy === "qr-metrics"}
                    onClick={refreshPrivateNumbers}
                    type="button"
                  >
                    {busy === "qr-metrics" ? "Refreshing…" : "Refresh count"}
                  </button>
                </div>
                <p>This QR stays tied to your locked Tuveloz profile address. Download it for cards, signs, or invoices.</p>
              </div>
            ) : (
              <div className="provider-qr-locked">
                <TuvelozIcon name="overview" />
                <strong>Publish your approved profile to activate its QR.</strong>
                <span>Private drafts and test profiles cannot create a public QR.</span>
              </div>
            )}
          </section>

          <section className="provider-business-card-panel">
            <div className="business-form-title">
              <span>D</span>
              <div><strong>Printable business cards</strong><small>Your unique QR is added automatically</small></div>
            </div>
            {activeQrSlug && qrDataUrl ? (
              <div className="provider-business-card-live">
                <article className="provider-business-card provider-business-card-preview">
                  <div className="provider-business-card-copy">
                    <div className="provider-card-brand">
                      <BrandMark compact />
                      <span>TUVE<strong>LOZ</strong></span>
                    </div>
                    <div>
                      <h3>{profile.businessName}</h3>
                      <p>{profile.headline || `${data.services.length} currently listed vehicle services`}</p>
                    </div>
                    <small>{displayLocation}</small>
                    <footer>VEHICLE SERVICES. <strong>CUSTOMER CHOICE. PROVIDER FREEDOM.</strong></footer>
                  </div>
                  <div className="provider-business-card-qr">
                    <img src={qrDataUrl} alt={`QR code for ${profile.businessName}`} />
                    <strong>SCAN MY PAGE</strong>
                    <span>Services · Work · Reviews</span>
                  </div>
                </article>
                <button className="button primary" onClick={printBusinessCards} type="button">
                  Print 10 business cards
                </button>
                <p>Creates a standard US Letter sheet with ten 3.5 × 2 inch cards ready to print and cut.</p>
              </div>
            ) : (
              <div className="provider-qr-locked">
                <TuvelozIcon name="storefront" />
                <strong>Publish your approved profile to create your cards.</strong>
                <span>Your permanent QR will be placed on every card automatically.</span>
              </div>
            )}
          </section>
        </aside>
      </div>
        </>
      )}

      {focus === "reviews" && (
      <section className="storefront-section provider-private-reviews" id="provider-reviews">
        <div className="storefront-section-heading">
          <div><span className="kicker">Reviews</span><h2>Completed-job customer feedback</h2></div>
          <div className="storefront-rating">
            <strong>{data.reviews.length ? data.reviewSummary.average.toFixed(1) : "—"}</strong>
            <span>{data.reviews.length ? "★★★★★".slice(0, Math.round(data.reviewSummary.average)) : "No reviews yet"}</span>
            <small>{data.reviews.length} completed-job {data.reviews.length === 1 ? "review" : "reviews"}</small>
          </div>
        </div>
        {data.reviews.length ? (
          <div className="storefront-review-grid">
            {data.reviews.map((review) => (
              <article key={review.id}>
                <div><span>{"★★★★★".slice(0, review.rating)}</span><strong>{review.rating}.0</strong></div>
                <blockquote>{review.comment}</blockquote>
                <footer>
                  <strong>{review.customerDisplayName}</strong>
                  <span>{review.service}</span>
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <div className="storefront-empty">
            <TuvelozIcon name="reviews" />
            <strong>No completed-job reviews yet.</strong>
            <span>Only feedback from completed Tuveloz jobs appears here.</span>
          </div>
        )}
      </section>
      )}

      {focus === "performance" && (
        <>
      <section className="provider-health" id="provider-performance">
        <div className="provider-health-score">
          <span className="kicker">Private coaching</span>
          <div>
            <strong>{data.profileHealth.score}<small>/100</small></strong>
            <span>Profile health</span>
          </div>
          <div
            aria-label="Profile health score"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={data.profileHealth.score}
            className="provider-health-progress"
            role="progressbar"
          >
            <span style={{ width: `${data.profileHealth.score}%` }} />
          </div>
          <p>This score is based on profile completeness only. It does not affect rankings or customer access.</p>
        </div>
        <div className="provider-health-guidance">
          <span className="kicker">Next improvements</span>
          <h3>Simple ways to strengthen your page</h3>
          <ul>
            {data.profileHealth.improvements.map((improvement) => (
              <li key={improvement}>
                <span aria-hidden="true">✓</span>
                <strong>{improvement}</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="provider-analytics">
        <div className="provider-analytics-heading">
          <div>
            <span className="kicker">Private analytics</span>
            <h3>Your real activity</h3>
            <p>Only confirmed Tuveloz activity appears here. These numbers are not public.</p>
          </div>
          <button
            className="button secondary"
            disabled={busy === "qr-metrics"}
            onClick={refreshPrivateNumbers}
            type="button"
          >
            {busy === "qr-metrics" ? "Refreshing…" : "Refresh numbers"}
          </button>
        </div>
        <div className="provider-analytics-grid">
          <article>
            <span>Profile views</span>
            <strong>{data.analytics.profileViews.toLocaleString()}</strong>
            <small>Public page loads; repeat visits can count again.</small>
          </article>
          <article>
            <span>QR scans</span>
            <strong>{data.analytics.qrScans.toLocaleString()}</strong>
            <small>Opens through your provider QR.</small>
          </article>
          <article>
            <span>Quotes sent</span>
            <strong>{data.analytics.quotesSent.toLocaleString()}</strong>
            <small>{data.analytics.pendingQuotes} still awaiting a decision.</small>
          </article>
          <article>
            <span>Quote acceptance</span>
            <strong>{data.analytics.quoteWinRate === null ? "—" : `${data.analytics.quoteWinRate}%`}</strong>
            <small>Accepted among decided quotes; pending quotes are excluded.</small>
          </article>
        </div>
        <div className="provider-decline-feedback">
          <div>
            <strong>Why customers passed</strong>
            <span>Optional feedback shown only as combined totals.</span>
          </div>
          {data.analytics.declineFeedback.length ? (
            <ul>
              {data.analytics.declineFeedback.map((reason) => (
                <li key={reason.value}>
                  <span>{reason.label}</span>
                  <strong>{reason.count}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>No decline feedback has been shared yet.</p>
          )}
        </div>
      </section>
        </>
      )}

      {focus === "profile" && (
      <div className="business-page-footer">
        <p>Service listings come from current eligibility records. Reviews shown here are linked to completed Tuveloz jobs; the link does not verify every statement or guarantee work. Your email and exact addresses are never shown here.</p>
        {profile.publicStatus === "published" ? (
          <div>
            <a className="button secondary" href={publicUrl} target="_blank" rel="noreferrer">View public page</a>
            <button className="button secondary" onClick={copyPublicLink} type="button">Copy page link</button>
          </div>
        ) : profile.id ? (
          <div>
            <a className="button secondary" href={privatePreviewUrl} target="_blank" rel="noreferrer">Preview private page</a>
            <span className="private-preview-note">Private link—do not share</span>
          </div>
        ) : <span>Save the draft to create a private preview.</span>}
      </div>
      )}
      {error && <p className="form-error business-page-message">{error}</p>}
      {notice && <p className="portal-success business-page-message">{notice}</p>}
      {focus === "profile" && activeQrSlug && qrDataUrl && (
        <div className="provider-card-print-sheet" aria-hidden="true">
          {printableCardSlots.map((slot) => (
            <article className="provider-business-card" key={slot}>
              <div className="provider-business-card-copy">
                <div className="provider-card-brand">
                  <BrandMark compact />
                  <span>TUVE<strong>LOZ</strong></span>
                </div>
                <div>
                  <h3>{profile.businessName}</h3>
                  <p>{profile.headline || `${data.services.length} currently listed vehicle services`}</p>
                </div>
                <small>{displayLocation}</small>
                <footer>VEHICLE SERVICES. <strong>CUSTOMER CHOICE. PROVIDER FREEDOM.</strong></footer>
              </div>
              <div className="provider-business-card-qr">
                <img src={qrDataUrl} alt="" />
                <strong>SCAN MY PAGE</strong>
                <span>Services · Work · Reviews</span>
                <small>{displayProfileUrl}</small>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
