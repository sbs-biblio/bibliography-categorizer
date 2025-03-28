const referenceTypes = [
    "🧪 Single Study",
    "📘 Book",
    "📚 Systematic Review",
    "📊 Meta-Analysis",
    "📝 Narrative Review / Opinion Piece",
    "📄 Guideline",
    "❓ Other"
];

const subjectOfStudy = [
    "🔬 Associated findings and diagnostic methods for SBS and/or AHT",
    "🎯 Race bias",
    "⚙️ Biomechanics (e.g., animal studies, crash test dummy simulations)",
    "📈 Incidence rates of AHT",
    "🌱 Outcomes and Long-Term Effects of AHT",
    "⚖️ Legal and Forensic Aspects (e.g., court case, forensic pathology, expert witness reliability)",
    "👤 Perpetrator characteristics, Risk Factors and Prevention Strategies",
    "❓ Other (please describe)"
];

const BASEURL = "";

let allReferences = [];
let filteredReferences = [];
let currentIndex = 0;
let uuid = null;
let classifications = {};

const sheetEndpoint = "https://script.google.com/macros/s/AKfycbx-bdRmz-7Rz6HhG-2cnkUmgYDvQ2gZqR_BR7YV5UYmOm43jA-7fBRbOZSI2RzhlOCwTg/exec";

document.addEventListener('DOMContentLoaded', async () => {
    uuid = new URLSearchParams(window.location.search).get("uuid");

    const response = await fetch("references.json");
    allReferences = await response.json();

    // Add 'author' field as first author (split by comma)
    allReferences.forEach(ref => {
        const firstAuthor = ref.authors.split(",")[0].trim();
        ref.author = firstAuthor;
    });

    // Remove entries without a valid PDF filename
    allReferences = allReferences.filter(ref => ref.pdf && ref.pdf.trim() !== "");

    // Filter by UUID if provided
    filteredReferences = uuid
        ? allReferences.filter(ref => ref.group === uuid)
        : allReferences;

    loadClassificationsFromStorage();
    renderArticleList();

    // Find the first unclassified reference (no article_type, topic, or motivation)
    let firstUnclassifiedIndex = filteredReferences.findIndex(ref => {
        const entry = classifications[ref.id];
        return !entry || (!entry.article_type && !entry.topic && !entry.motivation);
    });

    // Default to 0 if all are classified
    if (firstUnclassifiedIndex === -1) {
        firstUnclassifiedIndex = 0;
    }

    displayReference(firstUnclassifiedIndex);

    document.getElementById("prev-btn").onclick = () => {
        if (currentIndex > 0) displayReference(currentIndex - 1);
    };

    document.getElementById("next-btn").onclick = () => {
        if (currentIndex < filteredReferences.length - 1) displayReference(currentIndex + 1);
    };

    document.getElementById("download-btn").onclick = downloadClassifications;
    document.getElementById("upload-btn").onclick = () => document.getElementById("upload-input").click();
    document.getElementById("upload-input").addEventListener('change', handleUpload);

    document.getElementById("save-btn").addEventListener("click", submitClassificationsToGoogleSheet);

    document.getElementById("toggle-list").onclick = () => {
        document.getElementById("article-list").classList.toggle("hidden");
    };
    document.getElementById("motivation").addEventListener("input", saveCurrentClassification);
});

function renderOptions(containerId, options, selectedValue, onSelect) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    options.forEach(option => {
        const btn = document.createElement("button");
        btn.textContent = option;
        btn.className = "option-button";
        if (option === selectedValue) btn.classList.add("selected");

        btn.onclick = () => {
            // If clicking on the selected option → toggle off
            if (option === selectedValue) {
                onSelect(null); // clear the selection
            } else {
                onSelect(option); // update selection
            }
        };

        container.appendChild(btn);
    });
}

function displayReference(index) {
    if (index < 0 || index >= filteredReferences.length) return;
    currentIndex = index;
    const ref = filteredReferences[index];

    // Load PDF
    document.getElementById("pdf-viewer").src = `${BASEURL}pdfs/${ref.pdf}#view=FitH&navpanes=0`;

    // Update top info bar
    document.getElementById("article-info").textContent =
        `#${String(ref.id).padStart(3, '0')} • ${ref.year} • ${ref.author} • "${ref.title}" (${index + 1} of ${filteredReferences.length})`;

    // Load existing classification
    const entry = classifications[ref.id] || {};
    renderOptions("article-type-buttons", referenceTypes, entry.article_type, (val) => {
        classifications[ref.id] = classifications[ref.id] || {};
        classifications[ref.id].article_type = val;
        saveCurrentClassification();
        displayReference(currentIndex); // Refresh selection visuals
    });

    renderOptions("topic-buttons", subjectOfStudy, entry.topic, (val) => {
        classifications[ref.id] = classifications[ref.id] || {};
        classifications[ref.id].topic = val;
        saveCurrentClassification();
        displayReference(currentIndex);
    });

    document.getElementById("motivation").value = entry.motivation || "";
    highlightCurrentInList();
}

function saveCurrentClassification() {
    const ref = filteredReferences[currentIndex];
    const entry = classifications[ref.id] = classifications[ref.id] || {};
    entry.motivation = document.getElementById("motivation").value;
    localStorage.setItem(`classifications_${uuid || "all"}`, JSON.stringify(classifications));
}

function loadClassificationsFromStorage() {
    const saved = localStorage.getItem(`classifications_${uuid || "all"}`);
    if (saved) classifications = JSON.parse(saved);
}

function downloadClassifications() {
    const shortUuid = (uuid || "all").split("-")[0];

    const entries = filteredReferences.map(ref => {
        const entry = classifications[ref.id] || {};
        return {
            id: ref.id,
            group: uuid || "",
            year: ref.year || "",
            authors: ref.authors || "",
            title: ref.title || "",
            doi: ref.doi || "",
            article_type: entry.article_type || "",
            topic: entry.topic || "",
            motivation: entry.motivation || ""
        };
    }).filter(entry =>
        entry.article_type || entry.topic || entry.motivation
    );

    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `classifications_${shortUuid}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function submitClassificationsToGoogleSheet() {
    const entries = filteredReferences.map(ref => {
        const entry = classifications[ref.id] || {};
        return {
            id: ref.id,
            year: ref.year || "",
            authors: ref.authors || "",
            title: ref.title || "",
            doi: ref.doi || "",
            article_type: entry.article_type || "",
            topic: entry.topic || "",
            motivation: entry.motivation || ""
        };
    }).filter(entry =>
        entry.article_type || entry.topic || entry.motivation
    );

    const payload = {
        uuid: uuid || "unknown",
        entries
    };

    fetch(sheetEndpoint, {
        method: "POST",
        mode: "no-cors",  // ✅ suppresses CORS check
        body: JSON.stringify(payload),
        headers: {
            "Content-Type": "application/json"
        }
    })
        .then(() => showNotification("✅ Saved successfully"))
        .catch(err => {
            console.error("Error saving:", err);
            showNotification("❌ Failed to save", true);
        });
}

function handleUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const uploaded = JSON.parse(reader.result);
            uploaded.forEach(entry => {
                if (entry.id) classifications[entry.id] = entry;
            });
            localStorage.setItem(`classifications_${uuid || "all"}`, JSON.stringify(classifications));
            displayReference(currentIndex);
        } catch (e) {
            alert("Invalid JSON file.");
        }
    };
    reader.readAsText(file);
}

function renderArticleList() {
    const container = document.getElementById("article-list");
    container.innerHTML = "";
    filteredReferences.forEach((ref, idx) => {
        const btn = document.createElement("button");
        btn.innerHTML = `<strong>#${ref.id} - ${ref.year} - ${ref.author}</strong> - ${ref.title}`;
        btn.onclick = () => {
            document.getElementById("article-list").classList.add("hidden");
            displayReference(idx);
        };
        btn.id = `article-btn-${ref.id}`;
        container.appendChild(btn);
    });
}

function highlightCurrentInList() {
    filteredReferences.forEach(ref => {
        const btn = document.getElementById(`article-btn-${ref.id}`);
        if (btn) btn.classList.remove("active");
    });
    const ref = filteredReferences[currentIndex];
    const btn = document.getElementById(`article-btn-${ref.id}`);
    if (btn) btn.classList.add("active");
}

function showNotification(message, isError = false) {
    const box = document.getElementById("notification");
    box.textContent = message;
    box.className = "show" + (isError ? " error" : "");

    setTimeout(() => {
        box.className = "hidden";
    }, 3000); // hide after 3 seconds
}
