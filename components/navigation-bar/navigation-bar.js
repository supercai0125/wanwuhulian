Component({
  properties: {
    title: {
      type: String,
      value: ''
    },
    back: {
      type: Boolean,
      value: false
    },
    color: {
      type: String,
      value: '#000000'
    },
    background: {
      type: String,
      value: '#FFFFFF'
    }
  },

  data: {
    statusBarHeight: 20
  },

  lifetimes: {
    attached: function () {
      const systemInfo = wx.getSystemInfoSync();
      this.setData({
        statusBarHeight: systemInfo.statusBarHeight
      });
    }
  },

  methods: {
    goBack: function () {
      wx.navigateBack({
        delta: 1
      });
    }
  }
})
