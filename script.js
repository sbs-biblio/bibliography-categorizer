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
let uuids = [
    "a02e35b9-3620-4021-ab4a-acab6baa134a",
    "efba1e33-d566-476c-a042-14d94c084b62",
    "2291e0bc-2eb3-4d29-8c3d-eb38875aecdd",
    "42dde4a9-cb1b-4ea4-ab37-a5c14d341cb2",
    "e2eaba9d-4367-4162-ac71-152e824186e4",
    "c1482df3-0324-47c1-9d2e-d9453778272e",
    "c3306b65-3c6e-4bb5-9622-adb45c7f8c65",
    "6214f6c3-1c68-4fd5-832d-af072afe4d43",
    "d44da73a-4061-4258-a663-d31a13b98493",
    "059fef4f-5346-4b82-8318-35811f250831",
    "245430f2-ab7b-499d-b735-c71c3ca94d73",
    "c02c6ca3-b434-4400-ac6e-97c9430b5c0f",
    "e8570cec-c05a-4705-a7a0-286c73393e19",
    "75d0051c-1c45-47a7-b91a-05300dc81bac",
    "5cf91236-70b5-4a4a-9422-dcd355ffbb98",
    "15b400c0-cbb8-454c-ba2c-6b824bbcd93d",
    "db5c956f-0f72-4e61-848d-33b41ec68e20",
    "5df7392a-3293-41df-931d-33c2e34aa825",
    "eb232884-27bf-4bc9-862b-dea1bf6079d3",
    "3674c2fb-159e-413c-adc4-be3c69dc6841"
];
let classifications = {};

const sheetEndpoint = "https://script.google.com/macros/s/AKfycbwXf18LosPpJL3W4VzTVJeUyNh398Ge9cJXDPFJW2x-fJ8SC2M21vjgM9MYkiOtI3_Pog/exec";

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
    // NOTE: redundancy, will match all references with the current UUID OR the next UUID, for
    // redundancy.
    filteredReferences = uuid
        ? allReferences.filter(ref => {
            const currentIndex = uuids.indexOf(uuid);
            const nextIndex = (currentIndex + 1) % uuids.length;
            const nextUuid = uuids[nextIndex];
            return ref.group === uuid || ref.group === nextUuid;
        })
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
    if (!confirm("Please only submit your work once you're done with your batch. Everything is saved on your computer in the meantime. Do you want to submit your work now?")) return false;
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
