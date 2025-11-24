const CONFIG_URL = 'https://rough-wind-37be.dyw1618.workers.dev/env.json';
const PRESIGN_ENDPOINT = 'https://cos-presign-worker.dyw1618.workers.dev/presign?key=env.json&type=put';

let config = { title: '', sections: [] };
let draggedIndex = null;
let isEditing = false;
let cachedETag = '';
let lastConfigText = '';
async function loadConfig() {
    const status = document.getElementById('status');
    const title = document.getElementById('page-title');

    try {
        const res = await fetch(CONFIG_URL, {
            headers: cachedETag ? { 'If-None-Match': cachedETag } : {}
        });

        if (res.status === 304) {
            // 配置未变化，跳过更新
            status.textContent = '';
            return;
        }

        if (!res.ok) throw new Error(`加载失败：${res.status}`);

        const text = await res.text();
        config = JSON.parse(text);
        lastConfigText = text;
        cachedETag = res.headers.get('ETag') || '';

        // 更新页面标题
        title.textContent = config.title || '环境链接汇总';

        // 清空状态提示
        status.textContent = '';
        status.classList.remove('error');

        // 渲染配置内容
        renderConfig();
    } catch (err) {
        status.classList.add('error');
        status.textContent = '❌ 加载失败：' + err.message;
    }
}


async function saveConfig() {
    const status = document.getElementById('status');
    const newConfigText = JSON.stringify(config, null, 2);

    if (newConfigText === lastConfigText) {
        status.textContent = '⚠️ 配置未变化，无需保存';
        return;
    }

    try {
        status.classList.remove('error');
        status.textContent = '🌀 获取签名中...';
        const res = await fetch(PRESIGN_ENDPOINT);
        const { url } = await res.json();

        status.textContent = '📤 写入中...';
        const putRes = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: newConfigText,
        });

        if (!putRes.ok) throw new Error(`写入失败：${putRes.status}`);
        status.textContent = '✅ 保存成功';
        lastConfigText = newConfigText;
    } catch (err) {
        status.classList.add('error');
        status.textContent = '❌ 保存失败：' + err.message;
    }
}

loadConfig();
function toggleEditMode() {
    isEditing = !isEditing;
    document.getElementById('editor-buttons').style.display = isEditing ? 'block' : 'none';
    renderConfig();
}

function statusMessage(msg, isError = false) {
    const status = document.getElementById('status');
    status.textContent = msg;
    if (isError) {
        status.classList.add('error');
    } else {
        status.classList.remove('error');
    }
}

function renderConfig() {
    const content = document.getElementById('content');
    content.innerHTML = '';

    config.sections.forEach((section, secIndex) => {
        const sec = document.createElement('section');

        // 分组标题行
        const headerRow = document.createElement('div');
        headerRow.className = 'item-row';

        const titleSpan = document.createElement('span');
        titleSpan.textContent = section.title;
        titleSpan.className = 'editable';
        if (isEditing) {
            titleSpan.onclick = () => switchToSectionInput(titleSpan, secIndex);
        }

        const actions = document.createElement('div');
        actions.className = 'actions';

        const delGroupBtn = document.createElement('button');
        delGroupBtn.className = 'icon-btn';
        delGroupBtn.textContent = isEditing ? '❌' : '';
        delGroupBtn.onclick = () => removeSection(secIndex);
        actions.appendChild(delGroupBtn);

        headerRow.appendChild(titleSpan);
        headerRow.appendChild(actions);
        sec.appendChild(headerRow);

        // 每个链接项
        section.items.forEach((item, itemIndex) => {
            const row = document.createElement('div');
            row.className = 'item-row';

            const textGroup = document.createElement('div');
            textGroup.className = 'text-group';

            const labelSpan = document.createElement('span');
            labelSpan.textContent = item.label;
            labelSpan.className = 'editable';
            if (isEditing) {
                labelSpan.onclick = () => switchToLabelInput(labelSpan, secIndex, itemIndex, () => {
                    const urlSpan = row.querySelector('.text-group span:nth-child(2)');
                    if (urlSpan) switchToUrlInput(urlSpan, secIndex, itemIndex);
                });
            }

            const urlSpan = document.createElement('span');
            urlSpan.textContent = item.url;
            urlSpan.className = 'editable url';
            urlSpan.setAttribute('title', item.url); // ✅ 悬停显示完整链接
            if (isEditing) {
                urlSpan.onclick = () => switchToUrlInput(urlSpan, secIndex, itemIndex);
            } else {
                urlSpan.onclick = () => window.open(item.url, '_blank');
            }

            textGroup.appendChild(labelSpan);
            textGroup.appendChild(urlSpan);

            const actions = document.createElement('div');
            actions.className = 'actions';

            const copyBtn = document.createElement('button');
            copyBtn.className = 'icon-btn';
            copyBtn.textContent = '📋';
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(item.url).then(() => {
                    statusMessage(`已复制: ${item.url}`);
                }).catch(err => {
                    statusMessage('❌ 复制失败: ' + err.message, true);
                });
            };

            const delBtn = document.createElement('button');
            delBtn.className = 'icon-btn';
            delBtn.textContent = isEditing ? '❌' : '';
            delBtn.onclick = () => removeItem(secIndex, itemIndex);

            actions.appendChild(copyBtn);
            actions.appendChild(delBtn);

            row.appendChild(textGroup);
            row.appendChild(actions);
            sec.appendChild(row);
        });

        // 编辑模式下添加链接按钮
        if (isEditing) {
            const addBtn = document.createElement('button');
            addBtn.textContent = '➕ 添加链接';
            addBtn.onclick = () => addItem(secIndex);
            sec.appendChild(addBtn);
        }

        content.appendChild(sec);
    });
}




// 辅助函数：显示状态提示
function statusMessage(msg, isError = false) {
    const status = document.getElementById('status');
    status.textContent = msg;
    if (isError) {
        status.classList.add('error');
    } else {
        status.classList.remove('error');
    }
}


function handleDragStart(e) {
    draggedIndex = parseInt(e.currentTarget.getAttribute('data-index'));
    e.dataTransfer.effectAllowed = 'move';
}
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
    e.dataTransfer.dropEffect = 'move';
}
function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}
function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const targetIndex = parseInt(e.currentTarget.getAttribute('data-index'));
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    const draggedItem = config.sections[draggedIndex];
    config.sections.splice(draggedIndex, 1);
    config.sections.splice(targetIndex, 0, draggedItem);
    draggedIndex = null;
    renderConfig();
}
function switchToLabelInput(span, secIndex, itemIndex, onFinish) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = config.sections[secIndex].items[itemIndex].label;
    input.onblur = () => {
        config.sections[secIndex].items[itemIndex].label = input.value;
        renderConfig();
        if (typeof onFinish === 'function') onFinish();
    };
    input.onkeydown = e => { if (e.key === 'Enter') input.blur(); };
    span.replaceWith(input);
    input.focus();
}

function switchToUrlInput(span, secIndex, itemIndex) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = config.sections[secIndex].items[itemIndex].url;
    input.onblur = () => {
        config.sections[secIndex].items[itemIndex].url = input.value;
        renderConfig();
    };
    input.onkeydown = e => { if (e.key === 'Enter') input.blur(); };
    span.replaceWith(input);
    input.focus();
}

function switchToSectionInput(span, secIndex) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = config.sections[secIndex].title;
    input.onblur = () => {
        config.sections[secIndex].title = input.value;
        renderConfig();
    };
    input.onkeydown = e => { if (e.key === 'Enter') input.blur(); };
    span.replaceWith(input);
    input.focus();
}

function addItem(secIndex) {
    config.sections[secIndex].items.push({ label: '', url: '' });
    renderConfig();

    const sectionEl = document.querySelectorAll('section')[secIndex];
    const itemCount = config.sections[secIndex].items.length;
    const row = sectionEl.querySelectorAll('.item-row')[itemCount]; // 第一个是标题行

    const labelSpan = row.querySelector('span.editable:nth-child(1)');
    const urlSpan = row.querySelector('span.editable:nth-child(2)');

    if (labelSpan && urlSpan) {
        switchToLabelInput(labelSpan, secIndex, itemCount - 1, () => {
            // ✅ 延迟触发链接编辑，确保 DOM 已渲染
            setTimeout(() => {
                const updatedSection = document.querySelectorAll('section')[secIndex];
                const updatedRow = updatedSection.querySelectorAll('.item-row')[itemCount];
                const updatedUrlSpan = updatedRow.querySelector('span.editable:nth-child(2)');
                if (updatedUrlSpan) switchToUrlInput(updatedUrlSpan, secIndex, itemCount - 1);
            }, 0);
        });
    }
}


function removeItem(secIndex, itemIndex) {
    config.sections[secIndex].items.splice(itemIndex, 1);
    renderConfig();
}

function addSection() {
    config.sections.push({ title: '新分组', items: [] });
    renderConfig();

    const sectionEl = document.querySelectorAll('section');
    const lastIndex = sectionEl.length - 1;
    const titleSpan = sectionEl[lastIndex].querySelector('.item-row span.editable');
    if (titleSpan) switchToSectionInput(titleSpan, lastIndex);
}

function removeSection(index) {
    config.sections.splice(index, 1);
    renderConfig();
}
