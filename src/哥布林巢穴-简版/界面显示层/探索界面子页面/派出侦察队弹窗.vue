<template>
  <div v-if="show" class="scout-team-modal-overlay">
    <div class="scout-team-modal" @click.stop>
      <div class="modal-header">
        <h3>🔍 派出侦察队</h3>
        <button class="close-button" @click="handleClose">×</button>
      </div>

      <div class="modal-content">
        <div class="scout-options">
          <div class="option-group">
            <label>据点数量：</label>
            <select v-model="scoutCount" class="scout-count-select">
              <option value="1">1个据点</option>
              <option value="3">3个据点</option>
              <option value="5">5个据点</option>
            </select>
          </div>

          <div class="option-group">
            <label>侦察方向：</label>
            <select v-model="selectedLocationType">
              <option v-for="locType in availableLocationTypes" :key="locType.value" :value="locType.value">
                {{ locType.label }}
              </option>
            </select>
          </div>

          <div class="option-group">
            <label>侦察指令：</label>
            <div class="scout-location-info">
              <div class="location-display">
                <span class="location-label">当前探索位置：</span>
                <span class="location-value"
                  >{{ currentContinent || '未知大陆' }} - {{ currentRegion || '未知区域' }}</span
                >
              </div>
              <div class="location-description">
                <span class="description-text">{{ regionDescription || '暂无描述' }}</span>
              </div>
            </div>
            <textarea v-model="customPrompt" placeholder="可选：给侦察队下达特殊指令..." rows="3"></textarea>
          </div>
        </div>

        <div v-if="scoutResult" class="scout-result">
          <h4>侦察结果：</h4>
          <div v-if="scoutResult.success" class="success-message">
            <p>✅ 侦察队成功发现 {{ scoutResult.totalAdded || 1 }} 个目标！</p>
            <div v-if="scoutResult.locations && scoutResult.locations.length > 0" class="discovered-locations">
              <h5>发现的目标：</h5>
              <ul>
                <li v-for="location in scoutResult.locations" :key="location.id" class="location-item">
                  {{ location.icon }} {{ location.name }} ({{ getDifficultyText(location.difficulty) }},
                  {{ location.distance }}km)
                </li>
              </ul>
            </div>
          </div>
          <div v-else class="error-message">
            <p>❌ 侦察失败：{{ scoutResult.error }}</p>
          </div>
        </div>
      </div>

      <div class="modal-actions">
        <button class="cancel-button" @click="handleClose">取消</button>
        <button class="scout-button" :disabled="isGenerating" @click="handleSendScoutTeam">
          {{ isGenerating ? '侦察中...' : '派出侦察队' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { AILocationGenerationService } from '../../功能模块层/探索/服务/AI据点生成服务';
import { ExploreUIUtils } from '../../功能模块层/探索/服务/探索界面工具服务';
import { ConfirmService } from '../../核心层/服务/通用服务/确认框服务';
import { actionPointsService } from '../../核心层/服务/通用服务/行动力服务';

// Props
const props = defineProps<{
  show: boolean;
  currentContinent: string;
  currentRegion: string;
  regionDescription?: string;
  availableLocationTypes: Array<{ value: string; label: string }>;
}>();

// Emits
const emit = defineEmits<{
  close: [];
  scoutSuccess: [];
}>();

// 响应式数据
const scoutCount = ref(1);
const selectedLocationType = ref('');
const customPrompt = ref('');
const scoutResult = ref<any>(null);
const isGenerating = ref(false);

// 重置状态
watch(
  () => props.show,
  newVal => {
    if (!newVal) {
      scoutCount.value = 1;
      selectedLocationType.value = '';
      customPrompt.value = '';
      scoutResult.value = null;
      isGenerating.value = false;
    }
  },
);

// 工具函数（使用 ExploreUIUtils 服务）
const getDifficultyText = ExploreUIUtils.getDifficultyText;

// 关闭弹窗
const handleClose = async () => {
  // 如果用户关闭弹窗时侦察操作还在进行中，停止生成并重置状态
  if (isGenerating.value) {
    try {
      // 停止所有正在进行的生成操作（放弃这次酒馆的回复）
      await stopAllGeneration();
      console.log('已停止正在进行的侦察队生成操作');
    } catch (error) {
      console.error('停止生成操作失败:', error);
    }

    // 重置生成状态
    isGenerating.value = false;
    // 返还行动力（因为操作被用户中断）
    actionPointsService.refundActionPoints('sendScoutTeam');
    console.warn('用户关闭侦察队弹窗时操作仍在进行中，已停止生成、重置状态并返还行动力');
  }

  emit('close');
};

// 派出侦察队
const handleSendScoutTeam = async () => {
  if (isGenerating.value) return;

  // 检查行动力
  if (!actionPointsService.hasEnoughActionPoints('sendScoutTeam')) {
    await ConfirmService.showWarning(
      actionPointsService.getInsufficientActionPointsMessage('sendScoutTeam'),
      '行动力不足',
      '请等待下回合恢复行动力或征服更多区域增加上限',
    );
    return;
  }

  // 消耗行动力
  if (!actionPointsService.consumeActionPoints('sendScoutTeam')) {
    await ConfirmService.showDanger('行动力消耗失败', '操作失败');
    return;
  }

  isGenerating.value = true;
  scoutResult.value = null;

  try {
    // 根据条件侦察
    const conditions: any = {};
    if (selectedLocationType.value) {
      conditions.type = selectedLocationType.value;
    }

    // 构建自定义指令（如果有的话）
    let customInstruction = '';
    if (customPrompt.value.trim()) {
      customInstruction = `\n\n***最高级指令：${customPrompt.value.trim()}***`;
    }

    // 清除上次结果
    scoutResult.value = null;

    const count = parseInt(scoutCount.value.toString());

    // 使用统一的据点生成方法，支持条件筛选
    const result = await AILocationGenerationService.generateLocations(
      count,
      customInstruction,
      props.currentContinent,
      props.currentRegion,
      Object.keys(conditions).length > 0 ? conditions : undefined,
    );

    scoutResult.value = result;

    if (result.success) {
      // 自动关闭，延迟2秒让玩家看到结果
      setTimeout(() => {
        emit('scoutSuccess');
        handleClose();
      }, 2000);
    } else {
      // 侦察失败，返还行动力
      actionPointsService.refundActionPoints('sendScoutTeam');
    }
  } catch (error) {
    console.error('侦察队派出失败:', error);

    // 返还行动力（发生错误）
    actionPointsService.refundActionPoints('sendScoutTeam');

    scoutResult.value = {
      success: false,
      error: error instanceof Error ? error.message : '侦察失败',
    };
  } finally {
    isGenerating.value = false;
  }
};
</script>

<style scoped lang="scss">
.scout-team-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;

  .scout-team-modal {
    background: linear-gradient(180deg, rgba(40, 26, 20, 0.95), rgba(25, 17, 14, 0.98));
    border: 2px solid rgba(205, 133, 63, 0.4);
    border-radius: 16px;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    animation: modalSlideIn 0.3s ease-out;

    @media (max-width: 768px) {
      width: 95%;
      max-height: 90vh;
      height: 710px;
      border-radius: 12px;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid rgba(205, 133, 63, 0.2);

      h3 {
        margin: 0;
        color: #ffd7a1;
        font-size: 20px;
        font-weight: 700;
      }

      .close-button {
        background: none;
        border: none;
        color: #9ca3af;
        font-size: 24px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        transition: all 0.2s ease;
        line-height: 1;
        flex-shrink: 0;

        &:hover {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }

        &:active {
          transform: scale(0.95);
        }
      }
    }

    .modal-content {
      padding: 24px;

      @media (max-width: 768px) {
        padding: 16px;
      }

      .scout-options {
        .option-group {
          margin-bottom: 20px;

          @media (max-width: 768px) {
            margin-bottom: 16px;
          }

          label {
            display: block;
            color: #f0e6d2;
            font-weight: 600;
            margin-bottom: 8px;
          }

          select,
          textarea {
            width: 100%;
            padding: 8px 12px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(5, 150, 105, 0.3);
            border-radius: 6px;
            color: #f0e6d2;
            font-size: 14px;

            &:focus {
              outline: none;
              border-color: rgba(5, 150, 105, 0.6);
            }
          }

          textarea {
            resize: vertical;
            min-height: 80px;
            font-family: inherit;
          }

          .scout-count-select {
            width: 100%;
            padding: 8px 12px;
            background: rgba(40, 26, 20, 0.8);
            border: 1px solid rgba(205, 133, 63, 0.3);
            border-radius: 6px;
            color: #f0e6d2;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;

            &:focus {
              outline: none;
              border-color: rgba(205, 133, 63, 0.6);
              box-shadow: 0 0 0 2px rgba(205, 133, 63, 0.2);
            }

            option {
              background: rgba(40, 26, 20, 0.95);
              color: #f0e6d2;
            }
          }

          .scout-location-info {
            margin-bottom: 12px;
            padding: 12px;
            background: rgba(5, 150, 105, 0.1);
            border: 1px solid rgba(5, 150, 105, 0.3);
            border-radius: 6px;

            .location-display {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 6px;

              .location-label {
                color: #f0e6d2;
                font-size: 12px;
                font-weight: 600;
                opacity: 0.8;
              }

              .location-value {
                color: #059669;
                font-size: 12px;
                font-weight: 700;
              }
            }

            .location-description {
              .description-text {
                color: #f0e6d2;
                font-size: 11px;
                opacity: 0.9;
                line-height: 1.4;
              }
            }
          }
        }
      }

      .scout-result {
        margin-top: 20px;
        padding: 16px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;

        h4 {
          margin: 0 0 12px 0;
          color: #f0e6d2;
          font-size: 16px;
        }

        .success-message {
          color: #22c55e;

          .discovered-locations {
            margin-top: 12px;

            h5 {
              margin: 0 0 8px 0;
              color: #f0e6d2;
              font-size: 14px;
            }

            ul {
              margin: 0;
              padding-left: 20px;

              .location-item {
                color: #f0e6d2;
                font-size: 14px;
                margin-bottom: 4px;
              }
            }
          }
        }

        .error-message {
          color: #ef4444;
        }
      }
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 20px;
      padding: 16px 24px;
      border-top: 1px solid rgba(205, 133, 63, 0.2);

      @media (max-width: 768px) {
        padding: 12px 16px;
        gap: 8px;
      }

      .cancel-button,
      .scout-button {
        padding: 10px 20px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-weight: 600;
        font-size: 14px;
        border: none;

        @media (max-width: 768px) {
          padding: 8px 16px;
          font-size: 12px;
        }
      }

      .cancel-button {
        background: rgba(107, 114, 128, 0.2);
        border: 1px solid rgba(107, 114, 128, 0.3);
        color: #9ca3af;

        &:hover {
          background: rgba(107, 114, 128, 0.3);
        }
      }

      .scout-button {
        background: linear-gradient(180deg, #059669, #047857);
        border: 1px solid rgba(5, 150, 105, 0.6);
        color: #ffffff;

        &:hover:not(:disabled) {
          background: linear-gradient(180deg, #047857, #065f46);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
        }

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
      }
    }
  }
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
